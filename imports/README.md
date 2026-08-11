# Импорт семантики

Для импорта используются существующие таблицы SweetGift:

- `public.seo_topics` — уникальные названия групп;
- `public.seo_topic_queries` — пары «поисковый запрос / название группы».

Скрипт автоматически находит в CSV, TSV, TXT или XLSX два столбца по русским и
английским вариантам названий. Без флага `--apply` выполняется только проверка.

```bash
python3 scripts/import-semantics.py path/to/file.xlsx
python3 scripts/import-semantics.py path/to/file.xlsx --apply
```

После реального импорта вызывается существующая SQL-функция
`public.assign_missing_article_seo_topics()`. Старые запросы и группы не
удаляются и не перезаписываются.
