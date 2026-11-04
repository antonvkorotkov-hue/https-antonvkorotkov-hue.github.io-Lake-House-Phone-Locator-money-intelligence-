DROP TRIGGER sb_accept;
--> statement-breakpoint
CREATE TRIGGER sb_accept BEFORE INSERT ON sb_picks BEGIN
 SELECT CASE WHEN NEW.stake<100 OR NEW.stake>coalesce((SELECT value FROM sb_config WHERE key='max_stake'),1000000) OR typeof(NEW.stake)!='integer' THEN RAISE(ABORT,'League stake limit exceeded') END;
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM sb_users WHERE id=NEW.user_id AND enabled=1) THEN RAISE(ABORT,'Account disabled') END;
 SELECT CASE WHEN coalesce((SELECT sum(delta) FROM sb_postings WHERE account='member:'||NEW.user_id),0)<NEW.stake THEN RAISE(ABORT,'Insufficient virtual balance') END;
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM sb_quotes q JOIN sb_events e ON e.id=q.event_id WHERE q.id=NEW.quote_id AND q.event_id=NEW.event_id AND q.odds=NEW.odds AND q.licensed=1 AND q.suspended=0 AND e.state IN ('scheduled','live') AND q.source_at>0 AND q.source_at<=q.received_at AND q.received_at<=unixepoch() AND e.source_at<=unixepoch() AND e.source_at>=unixepoch()-60 AND q.received_at>=unixepoch()- CASE WHEN q.live=1 THEN 15 ELSE 120 END AND q.expires_at>unixepoch() AND q.closes_at>unixepoch() AND ((q.live=0 AND e.state='scheduled' AND e.starts_at>unixepoch()) OR (q.live=1 AND e.state='live'))) THEN RAISE(ABORT,'Market closed, stale, suspended or unavailable') END;
 SELECT CASE WHEN NEW.potential_return!=NEW.stake+ CASE WHEN NEW.odds>0 THEN NEW.stake*NEW.odds/100 ELSE NEW.stake*100/(-NEW.odds) END THEN RAISE(ABORT,'Return calculation mismatch') END;
 SELECT CASE WHEN coalesce((SELECT sum(potential_return) FROM sb_picks WHERE status='pending'),0)+NEW.potential_return>coalesce((SELECT value FROM sb_config WHERE key='max_liability'),100000000) THEN RAISE(ABORT,'House liability limit exceeded') END;
END;
