CREATE TABLE `sb_cashouts` (
	`pick_id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`request_key` text NOT NULL,
	`amount` integer NOT NULL,
	`quote_id` text NOT NULL,
	`counter_quote_id` text NOT NULL,
	`quote_received_at` integer NOT NULL,
	`counter_received_at` integer NOT NULL,
	`offer_expires_at` integer NOT NULL,
	`created_at` integer NOT NULL
);

--> statement-breakpoint
CREATE TRIGGER sb_cashout_validate BEFORE INSERT ON sb_cashouts BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM sb_picks WHERE id=NEW.pick_id AND user_id=NEW.user_id AND status='pending') THEN RAISE(ABORT,'Cash-out pick already closed or not owned') END;
 SELECT CASE WHEN NEW.offer_expires_at<=unixepoch() OR NEW.created_at>unixepoch() OR NEW.amount<1 OR typeof(NEW.amount)!='integer' THEN RAISE(ABORT,'Cash-out expired or invalid') END;
 SELECT CASE WHEN NOT EXISTS(
  SELECT 1 FROM sb_picks p JOIN sb_events e ON e.id=p.event_id JOIN sb_quotes q ON q.id=NEW.quote_id JOIN sb_quotes c ON c.id=NEW.counter_quote_id
  WHERE p.id=NEW.pick_id AND p.user_id=NEW.user_id AND p.status='pending'
   AND q.event_id=p.event_id AND c.event_id=p.event_id AND e.source_at<=unixepoch() AND e.source_at>=unixepoch()-60
   AND q.market=json_extract(p.snapshot,'$.market') AND q.period=json_extract(p.snapshot,'$.period') AND q.subject IS json_extract(p.snapshot,'$.subject') AND q.side=json_extract(p.snapshot,'$.side')
   AND ((q.line IS NULL AND json_extract(p.snapshot,'$.line') IS NULL) OR (q.line IS NOT NULL AND json_extract(p.snapshot,'$.line') IS NOT NULL AND CAST(q.line AS REAL)=CAST(json_extract(p.snapshot,'$.line') AS REAL)))
   AND c.source=q.source AND c.market=q.market AND c.period=q.period AND c.subject IS q.subject
   AND c.side=CASE q.side WHEN 'home' THEN 'away' WHEN 'away' THEN 'home' WHEN 'over' THEN 'under' WHEN 'under' THEN 'over' END
   AND ((q.line IS NULL AND c.line IS NULL) OR (q.line IS NOT NULL AND c.line IS NOT NULL AND CAST(c.line AS REAL)=CASE WHEN q.market IN ('spread','first_half') AND q.side IN ('home','away') THEN -CAST(q.line AS REAL) ELSE CAST(q.line AS REAL) END))
   AND q.received_at=NEW.quote_received_at AND c.received_at=NEW.counter_received_at AND abs(q.received_at-c.received_at)<=2
   AND q.licensed=1 AND q.suspended=0 AND q.source_at>0 AND q.source_at<=q.received_at AND q.received_at<=unixepoch() AND q.received_at>=unixepoch()-CASE WHEN q.live=1 THEN 15 ELSE 120 END AND q.expires_at>unixepoch() AND q.closes_at>unixepoch() AND ((q.live=1 AND e.state='live') OR (q.live=0 AND e.state='scheduled' AND e.starts_at>unixepoch())) AND c.licensed=1 AND c.suspended=0 AND c.source_at>0 AND c.source_at<=c.received_at AND c.received_at<=unixepoch() AND c.received_at>=unixepoch()-CASE WHEN c.live=1 THEN 15 ELSE 120 END AND c.expires_at>unixepoch() AND c.closes_at>unixepoch() AND ((c.live=1 AND e.state='live') OR (c.live=0 AND e.state='scheduled' AND e.starts_at>unixepoch()))
   AND NEW.amount=CAST(CAST(p.potential_return*((CASE WHEN q.odds>0 THEN 100.0/(q.odds+100) ELSE (-1.0*q.odds)/(-q.odds+100) END)/((CASE WHEN q.odds>0 THEN 100.0/(q.odds+100) ELSE (-1.0*q.odds)/(-q.odds+100) END)+(CASE WHEN c.odds>0 THEN 100.0/(c.odds+100) ELSE (-1.0*c.odds)/(-c.odds+100) END))) AS INTEGER)*95/100 AS INTEGER) AND NEW.amount<=p.potential_return
 ) THEN RAISE(ABORT,'Cash-out quote changed or unavailable') END;
END;
--> statement-breakpoint
CREATE TRIGGER sb_cashout_transfer AFTER INSERT ON sb_cashouts BEGIN
 INSERT INTO sb_postings(tx,account,delta,kind,reference,created_at) VALUES('cashout:'||NEW.pick_id,'member:'||NEW.user_id,NEW.amount,'cashout',NEW.pick_id,NEW.created_at);
 INSERT INTO sb_postings(tx,account,delta,kind,reference,created_at) VALUES('cashout:'||NEW.pick_id,'house',-NEW.amount,'cashout',NEW.pick_id,NEW.created_at);
 UPDATE sb_picks SET status='cashed_out' WHERE id=NEW.pick_id;
 INSERT INTO sb_audit(actor,action,payload,created_at) VALUES(NEW.user_id,'cashout_accepted',json_object('pick_id',NEW.pick_id,'amount',NEW.amount,'quote_id',NEW.quote_id,'counter_quote_id',NEW.counter_quote_id,'quote_received_at',NEW.quote_received_at,'counter_received_at',NEW.counter_received_at,'method','normalized_two_sided_95_percent'),NEW.created_at);
END;
--> statement-breakpoint
CREATE TRIGGER sb_cashout_no_settlement BEFORE INSERT ON sb_settlements WHEN EXISTS(SELECT 1 FROM sb_cashouts WHERE pick_id=NEW.pick_id) BEGIN SELECT RAISE(ABORT,'Pick already cashed out'); END;
--> statement-breakpoint
CREATE TRIGGER immutable_sb_cashouts_UPDATE BEFORE UPDATE ON sb_cashouts BEGIN SELECT RAISE(ABORT,'Cash-out history is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER immutable_sb_cashouts_DELETE BEFORE DELETE ON sb_cashouts BEGIN SELECT RAISE(ABORT,'Cash-out history is immutable'); END;
