# Swiggy One — prototype

A clickable prototype for a Swiggy One design exploration: six entry points that
try to sell the membership using the delivery fees the user has already paid,
rather than a list of benefits.

The ideas panel on the right of the screen moves between them:

1. **Home banner** — the full flow, from the receipt banner to the plan screen
2. **Home modal** — free delivery over ₹99
3. **Instamart modal** — free delivery over ₹199, built on Instamart history
4. **Auto eligibility** — fees have already passed the price of the membership
5. **Month projection** — fees on the way there, mid month
6. **Cart tooltip** — what removing One from the cart would cost

## Running it

It is static HTML, CSS and JavaScript with no build step, but it must be served
over HTTP rather than opened from the filesystem:

```sh
python3 -m http.server 8123
```

Then open <http://localhost:8123>.

## Deploying

Vercel needs no configuration. Import the repository, leave the framework preset
as **Other** and the root directory as `/`, and deploy — `index.html` is at the
root and everything else is a relative path.

## Credits

Product photography, typeface and trademarks: see [CREDITS.md](CREDITS.md).
