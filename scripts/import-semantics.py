#!/usr/bin/env python3
"""Import grouped SEO semantics into the existing SweetGift semantic core.

Dry-run is the default. Use --apply only after reviewing the dry-run output.
The script never creates permanent database objects and never deletes old data.
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import subprocess
import sys
import tempfile
import unicodedata
import zipfile
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable
from xml.etree import ElementTree as ET


ROOT = Path(__file__).resolve().parents[1]
SUPPORTED_SUFFIXES = {".xlsx", ".csv", ".tsv"}
QUERY_ALIASES = {
    "query",
    "query text",
    "query_text",
    "search query",
    "search_query",
    "keyword",
    "keywords",
    "поисковый запрос",
    "поисковые запросы",
    "запрос",
    "запросы",
}
GROUP_ALIASES = {
    "group",
    "group name",
    "group_name",
    "seo group",
    "seo_group",
    "topic title",
    "topic_title",
    "название группы",
    "группа",
    "исходная группа",
    "рекомендуемая группа",
}


@dataclass(frozen=True)
class SemanticRow:
    query_text: str
    group_name: str
    source_row: int


def normalize_text(value: object) -> str:
    text = unicodedata.normalize("NFC", str(value or ""))
    return re.sub(r"\s+", " ", text).strip()


def normalize_header(value: object) -> str:
    text = normalize_text(value).lower().replace("-", " ").replace(".", " ")
    return re.sub(r"\s+", " ", text).strip()


def is_query_header(value: object) -> bool:
    header = normalize_header(value)
    return (
        header in QUERY_ALIASES
        or ("поиск" in header and "запрос" in header)
        or header.startswith("query")
        or header.startswith("search query")
    )


def is_group_header(value: object) -> bool:
    header = normalize_header(value)
    return (
        header in GROUP_ALIASES
        or ("назван" in header and "груп" in header)
        or header.endswith("group")
        or header.endswith("group name")
    )


def discover_candidates() -> list[Path]:
    ignored = {".git", "node_modules", ".venv", "venv"}
    candidates: list[Path] = []
    for path in ROOT.rglob("*"):
        if not path.is_file() or path.suffix.lower() not in SUPPORTED_SUFFIXES:
            continue
        if any(part in ignored for part in path.parts):
            continue
        candidates.append(path)
    return sorted(candidates, key=lambda path: path.stat().st_mtime, reverse=True)


def column_name(index: int) -> str:
    result = ""
    while index:
        index, remainder = divmod(index - 1, 26)
        result = chr(65 + remainder) + result
    return result


def read_xlsx(path: Path) -> list[tuple[str, list[list[str]]]]:
    namespace = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
    rel_namespace = {
        "r": "http://schemas.openxmlformats.org/package/2006/relationships"
    }
    document_rel = (
        "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"
    )
    with zipfile.ZipFile(path) as archive:
        shared_strings: list[str] = []
        if "xl/sharedStrings.xml" in archive.namelist():
            root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
            for item in root.findall("m:si", namespace):
                shared_strings.append(
                    "".join(node.text or "" for node in item.iter() if node.tag.endswith("}t"))
                )

        workbook = ET.fromstring(archive.read("xl/workbook.xml"))
        relationships = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
        rel_targets = {
            rel.attrib["Id"]: rel.attrib["Target"]
            for rel in relationships.findall("r:Relationship", rel_namespace)
        }

        sheets: list[tuple[str, list[list[str]]]] = []
        for sheet in workbook.findall("m:sheets/m:sheet", namespace):
            sheet_name = sheet.attrib["name"]
            target = rel_targets[sheet.attrib[document_rel]].lstrip("/")
            sheet_path = target if target.startswith("xl/") else f"xl/{target}"
            xml = ET.fromstring(archive.read(sheet_path))
            rows: list[list[str]] = []
            for row_node in xml.findall(".//m:sheetData/m:row", namespace):
                cells: dict[int, str] = {}
                for cell in row_node.findall("m:c", namespace):
                    reference = cell.attrib.get("r", "A1")
                    letters = re.match(r"[A-Z]+", reference)
                    if not letters:
                        continue
                    column_index = 0
                    for character in letters.group(0):
                        column_index = column_index * 26 + ord(character) - 64
                    cell_type = cell.attrib.get("t")
                    value_node = cell.find("m:v", namespace)
                    if cell_type == "inlineStr":
                        value = "".join(
                            node.text or ""
                            for node in cell.iter()
                            if node.tag.endswith("}t")
                        )
                    elif value_node is None:
                        value = ""
                    elif cell_type == "s":
                        value = shared_strings[int(value_node.text or "0")]
                    else:
                        value = value_node.text or ""
                    cells[column_index] = value
                width = max(cells, default=0)
                rows.append([cells.get(index, "") for index in range(1, width + 1)])
            sheets.append((sheet_name, rows))
        return sheets


def read_delimited(path: Path) -> list[tuple[str, list[list[str]]]]:
    text = path.read_text(encoding="utf-8-sig")
    delimiter = "\t" if path.suffix.lower() == ".tsv" else ","
    if path.suffix.lower() == ".csv":
        try:
            delimiter = csv.Sniffer().sniff(text[:4096], delimiters=",;\t").delimiter
        except csv.Error:
            delimiter = ","
    return [(path.stem, list(csv.reader(text.splitlines(), delimiter=delimiter)))]


def find_data_sheet(
    sheets: Iterable[tuple[str, list[list[str]]]],
) -> tuple[str, list[list[str]], int, int, int]:
    matches: list[tuple[int, str, list[list[str]], int, int, int]] = []
    for sheet_name, rows in sheets:
        for row_index, row in enumerate(rows[:30]):
            query_columns = [index for index, value in enumerate(row) if is_query_header(value)]
            group_columns = [index for index, value in enumerate(row) if is_group_header(value)]
            if query_columns and group_columns:
                # A workbook may contain both the raw source and a curated import
                # sheet. Prefer an explicitly prepared sheet and canonical headers
                # before using row count as a tie-breaker.
                score = len(rows)
                if normalize_header(row[query_columns[0]]) == "query_text":
                    score += 10_000
                if normalize_header(row[group_columns[0]]) == "group_name":
                    score += 10_000
                if "готов" in normalize_header(sheet_name):
                    score += 100_000
                matches.append(
                    (
                        score,
                        sheet_name,
                        rows,
                        row_index,
                        query_columns[0],
                        group_columns[0],
                    )
                )
    if not matches:
        raise ValueError(
            "Не найдены два столбца: поисковый запрос и название группы"
        )
    _, sheet_name, rows, header_row, query_column, group_column = max(
        matches, key=lambda item: item[0]
    )
    return sheet_name, rows, header_row, query_column, group_column


def parse_rows(
    rows: list[list[str]],
    header_row: int,
    query_column: int,
    group_column: int,
) -> tuple[list[SemanticRow], int, int]:
    parsed: list[SemanticRow] = []
    empty_rows = 0
    error_rows = 0
    for source_index, row in enumerate(rows[header_row + 1 :], start=header_row + 2):
        query = normalize_text(row[query_column] if query_column < len(row) else "")
        group = normalize_text(row[group_column] if group_column < len(row) else "")
        if not query and not group:
            empty_rows += 1
            continue
        if not query or not group:
            error_rows += 1
            continue
        parsed.append(SemanticRow(query, group, source_index))
    return parsed, empty_rows, error_rows


def deduplicate(rows: list[SemanticRow]) -> tuple[list[SemanticRow], int]:
    unique: list[SemanticRow] = []
    seen: set[tuple[str, str]] = set()
    duplicate_count = 0
    for row in rows:
        key = (row.query_text.casefold(), row.group_name.casefold())
        if key in seen:
            duplicate_count += 1
            continue
        seen.add(key)
        unique.append(row)
    return unique, duplicate_count


def sql_literal(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def values_sql(rows: list[SemanticRow]) -> str:
    return ",\n".join(
        f"({sql_literal(row.query_text)}, {sql_literal(row.group_name)}, {row.source_row})"
        for row in rows
    )


def run_supabase_sql(sql: str) -> dict:
    with tempfile.NamedTemporaryFile(
        mode="w", suffix=".sql", encoding="utf-8", delete=False
    ) as handle:
        handle.write(sql)
        sql_path = Path(handle.name)
    try:
        command = [
            "supabase",
            "db",
            "query",
            "--linked",
            "--file",
            str(sql_path),
            "--output-format",
            "json",
        ]
        completed = subprocess.run(
            command,
            cwd=ROOT,
            text=True,
            capture_output=True,
            check=False,
        )
        if completed.returncode:
            raise RuntimeError((completed.stderr or completed.stdout).strip())
        start = completed.stdout.find("{")
        if start < 0:
            raise RuntimeError(f"Supabase CLI вернул неожиданный ответ: {completed.stdout}")
        response = json.loads(completed.stdout[start:])
        result_rows = response.get("rows") or []
        if not result_rows:
            raise RuntimeError("SQL-запрос не вернул результат")
        return result_rows[0]
    finally:
        sql_path.unlink(missing_ok=True)


def dry_run_sql(rows: list[SemanticRow]) -> str:
    return f"""
with input(query_text, group_name, source_row) as (
  values
  {values_sql(rows)}
),
normalized as (
  select
    query_text,
    group_name,
    regexp_replace(lower(query_text), '\\s+', ' ', 'g') as query_key,
    regexp_replace(lower(group_name), '\\s+', ' ', 'g') as group_key
  from input
),
existing_groups as (
  select distinct n.group_key
  from normalized n
  join public.seo_topics t
    on regexp_replace(lower(trim(t.title)), '\\s+', ' ', 'g') = n.group_key
),
existing_queries as (
  select distinct n.query_key, n.group_key
  from normalized n
  join public.seo_topic_queries q
    on regexp_replace(lower(trim(q.query_text)), '\\s+', ' ', 'g') = n.query_key
   and regexp_replace(lower(trim(q.topic_title)), '\\s+', ' ', 'g') = n.group_key
)
select jsonb_build_object(
  'existing_queries', (select count(*) from existing_queries),
  'new_queries', (select count(*) from normalized) - (select count(*) from existing_queries),
  'existing_groups', (select count(*) from existing_groups),
  'new_groups', (select count(distinct group_key) from normalized) - (select count(*) from existing_groups)
) as dry_run;
"""


def apply_sql(
    rows: list[SemanticRow],
    total_rows: int,
    duplicate_count: int,
    empty_rows: int,
    error_rows: int,
) -> str:
    return f"""
begin;

create temporary table semantic_import_input (
  query_text text not null,
  group_name text not null,
  source_row integer not null,
  query_key text not null,
  group_key text not null
) on commit drop;

insert into semantic_import_input (
  query_text, group_name, source_row, query_key, group_key
)
select
  query_text,
  group_name,
  source_row,
  regexp_replace(lower(query_text), '\\s+', ' ', 'g'),
  regexp_replace(lower(group_name), '\\s+', ' ', 'g')
from (
  values
  {values_sql(rows)}
) as source(query_text, group_name, source_row);

create temporary table semantic_import_result (
  payload jsonb not null
) on commit drop;

with distinct_groups as (
  select distinct on (group_key) group_name, group_key
  from semantic_import_input
  order by group_key, source_row
),
existing_groups as materialized (
  select d.group_key, t.title
  from distinct_groups d
  join public.seo_topics t
    on regexp_replace(lower(trim(t.title)), '\\s+', ' ', 'g') = d.group_key
),
inserted_groups as (
  insert into public.seo_topics (title, is_active)
  select d.group_name, true
  from distinct_groups d
  where not exists (
    select 1 from existing_groups e where e.group_key = d.group_key
  )
  on conflict (title) do update set is_active = true
  returning title
),
resolved_groups as (
  select group_key, title from existing_groups
  union all
  select
    regexp_replace(lower(trim(title)), '\\s+', ' ', 'g') as group_key,
    title
  from inserted_groups
),
resolved_input as (
  select i.query_text, i.query_key, i.group_key, g.title as topic_title
  from semantic_import_input i
  join resolved_groups g using (group_key)
),
existing_queries as materialized (
  select distinct r.query_key, r.group_key
  from resolved_input r
  join public.seo_topic_queries q
    on regexp_replace(lower(trim(q.query_text)), '\\s+', ' ', 'g') = r.query_key
   and regexp_replace(lower(trim(q.topic_title)), '\\s+', ' ', 'g') = r.group_key
),
inserted_queries as (
  insert into public.seo_topic_queries (query_text, topic_title)
  select r.query_text, r.topic_title
  from resolved_input r
  where not exists (
    select 1
    from existing_queries e
    where e.query_key = r.query_key and e.group_key = r.group_key
  )
  on conflict (query_text, topic_title) do nothing
  returning id
)
insert into semantic_import_result(payload)
select jsonb_build_object(
  'total_rows', {total_rows},
  'valid_unique_rows', (select count(*) from semantic_import_input),
  'queries_added', (select count(*) from inserted_queries),
  'queries_updated', 0,
  'queries_existing', (select count(*) from existing_queries),
  'duplicates_skipped', {duplicate_count},
  'empty_rows_skipped', {empty_rows},
  'groups_added', (select count(*) from inserted_groups),
  'groups_existing', (select count(*) from existing_groups),
  'errors', {error_rows}
);

select jsonb_build_object(
  'import', (select payload from semantic_import_result),
  'processing', public.assign_missing_article_seo_topics()
) as result;

commit;
"""


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Dry-run or import grouped semantics into SweetGift"
    )
    parser.add_argument("file", nargs="?", type=Path)
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Perform the import. Without this flag only dry-run is executed.",
    )
    parser.add_argument(
        "--list-candidates",
        action="store_true",
        help="List candidate CSV/XLSX/TSV files and exit.",
    )
    args = parser.parse_args()

    candidates = discover_candidates()
    if args.list_candidates:
        for candidate in candidates:
            print(
                json.dumps(
                    {
                        "path": str(candidate.relative_to(ROOT)),
                        "modified_at": candidate.stat().st_mtime,
                        "size": candidate.stat().st_size,
                    },
                    ensure_ascii=False,
                )
            )
        return 0

    selected = args.file.resolve() if args.file else (candidates[0] if candidates else None)
    if not selected or not selected.exists():
        raise FileNotFoundError("Не найден подходящий XLSX/CSV/TSV-файл")
    if selected.suffix.lower() not in SUPPORTED_SUFFIXES:
        raise ValueError(f"Неподдерживаемый формат: {selected.suffix}")

    sheets = read_xlsx(selected) if selected.suffix.lower() == ".xlsx" else read_delimited(selected)
    sheet_name, matrix, header_row, query_column, group_column = find_data_sheet(sheets)
    rows, empty_rows, error_rows = parse_rows(
        matrix, header_row, query_column, group_column
    )
    unique_rows, duplicate_count = deduplicate(rows)
    if not unique_rows:
        raise ValueError("После нормализации не осталось строк для импорта")

    base_report = {
        "mode": "apply" if args.apply else "dry-run",
        "file": str(selected.relative_to(ROOT))
        if selected.is_relative_to(ROOT)
        else str(selected),
        "sheet": sheet_name,
        "detected_columns": {
            "query": {
                "name": matrix[header_row][query_column],
                "column": column_name(query_column + 1),
            },
            "group": {
                "name": matrix[header_row][group_column],
                "column": column_name(group_column + 1),
            },
        },
        "total_rows": len(rows) + empty_rows + error_rows,
        "valid_rows": len(rows),
        "unique_queries": len({row.query_text.casefold() for row in unique_rows}),
        "unique_groups": len({row.group_name.casefold() for row in unique_rows}),
        "duplicates_in_file": duplicate_count,
        "empty_rows": empty_rows,
        "invalid_rows": error_rows,
        "examples": [
            {"query_text": row.query_text, "group_name": row.group_name}
            for row in unique_rows[:10]
        ],
    }

    if args.apply:
        database_report = run_supabase_sql(
            apply_sql(
                unique_rows,
                base_report["total_rows"],
                duplicate_count,
                empty_rows,
                error_rows,
            )
        )
        base_report.update(database_report)
    else:
        database_report = run_supabase_sql(dry_run_sql(unique_rows))
        base_report["database"] = database_report["dry_run"]

    print(json.dumps(base_report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(
            json.dumps(
                {"ok": False, "error": str(error)},
                ensure_ascii=False,
                indent=2,
            ),
            file=sys.stderr,
        )
        raise SystemExit(1)
