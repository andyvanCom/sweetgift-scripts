# SweetGift Gift Quiz

## Tilda T123

```html
<div class="sg-gift-quiz" data-limit="4" data-show-all="6"></div>
```

The loader loads `sweetgift-gift-quiz.js`; the module initializes only when the
container exists. Repeated Tilda renders are handled by an idempotent, throttled
`MutationObserver`.

## Ranking

`get_gift_quiz_recommendations(jsonb, integer)` makes one backend request per
answer. Availability and budget are hard gates. Ranking is lexicographic:
answer relevance first, then the combined score. The score is composed of up to
50 relevance points and up to 50 behavioral points (orders 20, carts 15, views
10, weekly trend 5). Recommendation reasons are emitted only by rules that
actually matched.

The production catalog audit on 2026-08-14 found 784 available priced products:
185 below 5,000 ₽; 69 from 5,000–6,999 ₽; 167 from 7,000–9,999 ₽; 186 from
10,000–14,999 ₽; and 177 from 15,000 ₽. Therefore the proposed ranges were kept.

## Known data limitations

The first release intentionally does not expose restriction chips for alcohol,
storage life, physical size, or visual scale. Those attributes do not have
complete normalized coverage in the current catalog, so presenting them as hard
filters would be misleading. Perishability is used only as a cautious ranking
signal and never as an exclusion.

Quiz state is stored in `sessionStorage`. Query parameters are not used, avoiding
indexable duplicate URLs. Funnel events are appended to `gift_quiz_events` only
through `track_gift_quiz_event`; the table itself is unavailable to frontend
roles.
