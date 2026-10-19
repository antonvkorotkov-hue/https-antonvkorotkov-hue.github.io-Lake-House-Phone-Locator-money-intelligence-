"""Validate committed observations without asserting that external feeds are complete."""
import json
import math
import unittest
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def timestamp(value):
    parsed = datetime.fromisoformat(value.replace('Z', '+00:00'))
    assert parsed.tzinfo is not None, 'Observation timestamps must include a timezone'
    return parsed


class SnapshotIntegrity(unittest.TestCase):
    def test_scoreboards(self):
        snapshot = json.loads((ROOT / 'scoreboards.json').read_text())
        self.assertEqual(set(snapshot['sports']), {'nfl', 'college', 'nba', 'mlb'})
        for sport, payload in snapshot['sports'].items():
            timestamp(payload['collected_at'])
            ids = [e['id'] for e in payload['events']]
            self.assertEqual(len(ids), len(set(ids)), sport + ' duplicate games')
            for event in payload['events']:
                timestamp(event['date'])
                competitors = event['competitions'][0]['competitors']
                self.assertEqual(len(competitors), 2)
                self.assertEqual({p['homeAway'] for p in competitors}, {'home', 'away'})
                self.assertNotEqual(competitors[0]['team']['id'], competitors[1]['team']['id'])
        for key, history in snapshot['history'].items():
            self.assertIn(key.split(':')[0], snapshot['sports'])
            times = [timestamp(row['time']) for row in history]
            self.assertEqual(times, sorted(times), key + ' out of order observations')
            for row in history:
                self.assertEqual(row['provider'], key.split(':', 2)[2])

    def test_exchange(self):
        snapshot = json.loads((ROOT / 'public-trades.json').read_text())
        timestamp(snapshot['collected_at'])
        tickers = [m['ticker'] for m in snapshot['markets']]
        self.assertEqual(len(tickers), len(set(tickers)), 'Duplicate contracts')
        count = 0
        for market in snapshot['markets']:
            self.assertTrue(market['ticker'].startswith(market['series'] + '-'))
            timestamp(market['collected_at'])
            ids = [trade['id'] for trade in market['trades']]
            self.assertEqual(len(ids), len(set(ids)), market['ticker'] + ' duplicate trades')
            for trade in market['trades']:
                timestamp(trade['time'])
                self.assertIn(trade['side'], ['yes', 'no'])
                contracts, premium = float(trade['contracts']), float(trade['premium_usd'])
                self.assertTrue(math.isfinite(contracts) and contracts > 0)
                self.assertTrue(math.isfinite(premium) and 0 <= premium <= contracts + 0.0001)
                count += 1
        print(f'Validated {len(tickers)} contracts / {count} observed trades; no completeness claim.')


if __name__ == '__main__':
    unittest.main()
