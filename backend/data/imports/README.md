# TCG Market Intelligence Dataset — 370K+ Trading Card Products

## Overview

This dataset contains real market data for **370,158 trading card game products** across 25 categories, including daily price snapshots and computed financial metrics (drift, volatility, Sharpe ratio).

This is a snapshot from the **TCG Oracle** daily pipeline which pulls data from TCGCSV. For live, real-time data, install the Python client: `pip install tcg-oracle-tools`.

## Files

### `tcg_market_data.csv`
Current market prices for all tracked products.

| Column | Description |
|--------|-------------|
| product_id | Unique TCGCSV product identifier |
| name | Product name (card, pack, box, etc.) |
| game | Game name (Pokemon, Magic: The Gathering, Yu-Gi-Oh!, etc.) |
| rarity | Card rarity (Rare, Ultra Rare, etc.) |
| market_price | Current TCGPlayer market price (USD) |
| low_price | Lowest listed price |
| mid_price | Median listed price |
| high_price | Highest listed price |
| price_date | Date of price snapshot |

### `tcg_volatility_stats.csv`
7-day rolling financial metrics computed using the Shroomy Oracle statistical engine.

| Column | Description |
|--------|-------------|
| product_id | Matches market data file |
| name | Product name |
| game | Game name |
| drift_7d | 7-day price drift (positive = trending up) |
| volatility_7d | 7-day price volatility (higher = riskier) |
| last_price | Most recent price |
| sharpe_ratio | Risk-adjusted return (drift / volatility) |

## Games Covered (25 Categories)

- Magic: The Gathering — 113,860 products
- Yu-Gi-Oh! — 46,509 products
- Pokémon — 30,353 products
- Pokémon (Japanese) — 29,818 products
- Weiss Schwarz — 29,608 products
- Cardfight Vanguard — 25,084 products
- Dragon Ball Super CCG — 11,633 products
- Flesh & Blood — 9,473 products
- Digimon — 8,909 products
- UniVersus — 8,117 products
- Star Wars Unlimited — 6,973 products
- One Piece — 6,727 products
- Disney Lorcana — 2,908 products
- Gundam — 1,398 products
- + 11 more categories

## Use Cases

- **Arbitrage detection**: Find cards where current_price < Monte Carlo lower bound
- **Portfolio analysis**: Track drift and volatility across card collections
- **Price forecasting**: Use drift/volatility as inputs to stochastic models
- **Market research**: Compare price dynamics across different card games
- **Phygital analysis**: Cross-reference tokenized cards (NFTs) against physical market prices

## Live API

This is a static snapshot. For live, daily-updated data with AI card grading and Monte Carlo simulation:

```python
pip install tcg-oracle-tools

from tcg_oracle import TCGOracleClient
client = TCGOracleClient()
results = client.search("Force of Will")
```

Also available as an MCP server for Claude, Cursor, and Windsurf:
```
tcg-oracle-mcp
```

**Full tutorial:** https://dev.to/sailor_pepe_7920f552c5b9a/build-an-autonomous-pokemon-card-trading-agent-with-ai-grading-monte-carlo-pricing-2b86

## License

Data sourced from TCGCSV (public TCGPlayer market data). Dataset provided for research and educational purposes.
