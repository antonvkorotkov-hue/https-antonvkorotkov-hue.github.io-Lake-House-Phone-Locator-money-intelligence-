CREATE UNIQUE INDEX sb_only_admin ON sb_users(role) WHERE role='admin';
--> statement-breakpoint
CREATE UNIQUE INDEX sb_pick_retry ON sb_picks(user_id,request_key);
--> statement-breakpoint
CREATE UNIQUE INDEX sb_settlement_version ON sb_settlements(pick_id,version);
--> statement-breakpoint
CREATE INDEX sb_postings_account ON sb_postings(account);
--> statement-breakpoint
CREATE TRIGGER sb_member_invited BEFORE INSERT ON sb_users WHEN NEW.role='member' BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM sb_invites WHERE digest=NEW.invite_digest AND used_by IS NULL AND expires_at>unixepoch() AND starting_balance=NEW.initial_balance) THEN RAISE(ABORT,'Invitation invalid or expired') END;
END;
--> statement-breakpoint
CREATE TRIGGER sb_user_grant AFTER INSERT ON sb_users BEGIN
 INSERT INTO sb_postings(tx,account,delta,kind,reference,created_at) VALUES('grant:'||NEW.id,'member:'||NEW.id,NEW.initial_balance,'initial_grant',NEW.id,unixepoch());
 INSERT INTO sb_postings(tx,account,delta,kind,reference,created_at) VALUES('grant:'||NEW.id,'issuance',-NEW.initial_balance,'initial_grant',NEW.id,unixepoch());
 UPDATE sb_invites SET used_by=NEW.id WHERE digest=NEW.invite_digest;
 INSERT INTO sb_audit(actor,action,payload,created_at) VALUES(NEW.id,'account_created',json_object('role',NEW.role,'initial_balance',NEW.initial_balance),unixepoch());
END;
--> statement-breakpoint
CREATE TRIGGER sb_guard BEFORE INSERT ON sb_guards BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM sb_sessions s JOIN sb_users u ON u.id=s.user_id WHERE s.digest=NEW.session_digest AND s.expires_at>unixepoch() AND u.enabled=1 AND (NEW.role='member' OR u.role='admin')) THEN RAISE(ABORT,'Session revoked or permission denied') END;
END;
--> statement-breakpoint
CREATE TRIGGER sb_accept BEFORE INSERT ON sb_picks BEGIN
 SELECT CASE WHEN NEW.stake<100 OR NEW.stake>coalesce((SELECT value FROM sb_config WHERE key='max_stake'),1000000) OR typeof(NEW.stake)!='integer' THEN RAISE(ABORT,'League stake limit exceeded') END;
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM sb_users WHERE id=NEW.user_id AND enabled=1) THEN RAISE(ABORT,'Account disabled') END;
 SELECT CASE WHEN coalesce((SELECT sum(delta) FROM sb_postings WHERE account='member:'||NEW.user_id),0)<NEW.stake THEN RAISE(ABORT,'Insufficient virtual balance') END;
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM sb_quotes q JOIN sb_events e ON e.id=q.event_id WHERE q.id=NEW.quote_id AND q.event_id=NEW.event_id AND q.odds=NEW.odds AND q.licensed=1 AND q.suspended=0 AND e.state IN ('scheduled','live') AND q.source_at<=unixepoch() AND q.received_at<=unixepoch() AND e.source_at<=unixepoch() AND e.source_at>=unixepoch()-60 AND q.source_at>=unixepoch()- CASE WHEN q.live=1 THEN 15 ELSE 120 END AND q.received_at>=unixepoch()- CASE WHEN q.live=1 THEN 15 ELSE 120 END AND q.expires_at>unixepoch() AND q.closes_at>unixepoch() AND ((q.live=0 AND e.state='scheduled' AND e.starts_at>unixepoch()) OR (q.live=1 AND e.state='live'))) THEN RAISE(ABORT,'Market closed, stale, suspended or unavailable') END;
 SELECT CASE WHEN NEW.potential_return!=NEW.stake+ CASE WHEN NEW.odds>0 THEN NEW.stake*NEW.odds/100 ELSE NEW.stake*100/(-NEW.odds) END THEN RAISE(ABORT,'Return calculation mismatch') END;
 SELECT CASE WHEN coalesce((SELECT sum(potential_return) FROM sb_picks WHERE status='pending'),0)+NEW.potential_return>coalesce((SELECT value FROM sb_config WHERE key='max_liability'),100000000) THEN RAISE(ABORT,'House liability limit exceeded') END;
END;
--> statement-breakpoint
CREATE TRIGGER sb_reserve AFTER INSERT ON sb_picks BEGIN
 INSERT INTO sb_postings(tx,account,delta,kind,reference,created_at) VALUES('stake:'||NEW.id,'member:'||NEW.user_id,-NEW.stake,'accepted_stake',NEW.id,NEW.created_at);
 INSERT INTO sb_postings(tx,account,delta,kind,reference,created_at) VALUES('stake:'||NEW.id,'house',NEW.stake,'accepted_stake',NEW.id,NEW.created_at);
 INSERT INTO sb_audit(actor,action,payload,created_at) VALUES(NEW.user_id,'wager_accepted',json_object('pick_id',NEW.id,'snapshot',json(NEW.snapshot),'stake',NEW.stake),NEW.created_at);
END;
--> statement-breakpoint
CREATE TRIGGER sb_pick_frozen BEFORE UPDATE OF user_id,quote_id,event_id,event_name,selection,odds,stake,potential_return,request_key,created_at,snapshot ON sb_picks BEGIN SELECT RAISE(ABORT,'Accepted wager is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER sb_pick_no_delete BEFORE DELETE ON sb_picks BEGIN SELECT RAISE(ABORT,'Accepted wager is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER sb_settle_validate BEFORE INSERT ON sb_settlements BEGIN
 SELECT CASE WHEN NEW.version<=coalesce((SELECT max(version) FROM sb_settlements WHERE pick_id=NEW.pick_id),0) THEN RAISE(ABORT,'Result version must increase') END;
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM sb_picks WHERE id=NEW.pick_id AND NEW.status IN ('win','loss','push','void') AND NEW.payout=CASE WHEN NEW.status='win' THEN potential_return WHEN NEW.status IN ('push','void') THEN stake ELSE 0 END) THEN RAISE(ABORT,'Invalid settlement') END;
END;
--> statement-breakpoint
CREATE TRIGGER sb_settle_transfer AFTER INSERT ON sb_settlements BEGIN
 INSERT INTO sb_postings(tx,account,delta,kind,reference,created_at) SELECT 'result:'||NEW.id,'member:'||p.user_id,NEW.payout-coalesce((SELECT payout FROM sb_settlements WHERE pick_id=NEW.pick_id AND version<NEW.version ORDER BY version DESC LIMIT 1),0),'settlement',NEW.pick_id,NEW.created_at FROM sb_picks p WHERE p.id=NEW.pick_id;
 INSERT INTO sb_postings(tx,account,delta,kind,reference,created_at) SELECT 'result:'||NEW.id,'house',-(NEW.payout-coalesce((SELECT payout FROM sb_settlements WHERE pick_id=NEW.pick_id AND version<NEW.version ORDER BY version DESC LIMIT 1),0)),'settlement',NEW.pick_id,NEW.created_at;
 UPDATE sb_picks SET status=NEW.status WHERE id=NEW.pick_id;
 INSERT INTO sb_audit(actor,action,payload,created_at) VALUES(NULL,'settled',json_object('pick_id',NEW.pick_id,'version',NEW.version,'status',NEW.status,'source',NEW.source),NEW.created_at);
END;
--> statement-breakpoint
CREATE TRIGGER sb_adjust_validate BEFORE INSERT ON sb_adjustments BEGIN
 SELECT CASE WHEN coalesce((SELECT sum(delta) FROM sb_postings WHERE account='member:'||NEW.user_id),0)+NEW.amount<0 THEN RAISE(ABORT,'Adjustment exceeds balance') END;
END;
--> statement-breakpoint
CREATE TRIGGER sb_adjust_transfer AFTER INSERT ON sb_adjustments BEGIN
 INSERT INTO sb_postings(tx,account,delta,kind,reference,created_at) VALUES('adjust:'||NEW.id,'member:'||NEW.user_id,NEW.amount,'admin_adjustment',NEW.id,NEW.created_at);
 INSERT INTO sb_postings(tx,account,delta,kind,reference,created_at) VALUES('adjust:'||NEW.id,'issuance',-NEW.amount,'admin_adjustment',NEW.id,NEW.created_at);
 INSERT INTO sb_audit(actor,action,payload,created_at) VALUES(NEW.actor,'balance_adjustment',json_object('member_id',NEW.user_id,'amount',NEW.amount,'reason',NEW.reason),NEW.created_at);
END;

--> statement-breakpoint
CREATE TRIGGER immutable_sb_postings_UPDATE BEFORE UPDATE ON sb_postings BEGIN SELECT RAISE(ABORT,'Append-only ledger and audit'); END;

--> statement-breakpoint
CREATE TRIGGER immutable_sb_postings_DELETE BEFORE DELETE ON sb_postings BEGIN SELECT RAISE(ABORT,'Append-only ledger and audit'); END;

--> statement-breakpoint
CREATE TRIGGER immutable_sb_audit_UPDATE BEFORE UPDATE ON sb_audit BEGIN SELECT RAISE(ABORT,'Append-only ledger and audit'); END;

--> statement-breakpoint
CREATE TRIGGER immutable_sb_audit_DELETE BEFORE DELETE ON sb_audit BEGIN SELECT RAISE(ABORT,'Append-only ledger and audit'); END;

--> statement-breakpoint
CREATE TRIGGER immutable_sb_settlements_UPDATE BEFORE UPDATE ON sb_settlements BEGIN SELECT RAISE(ABORT,'Append-only ledger and audit'); END;

--> statement-breakpoint
CREATE TRIGGER immutable_sb_settlements_DELETE BEFORE DELETE ON sb_settlements BEGIN SELECT RAISE(ABORT,'Append-only ledger and audit'); END;

--> statement-breakpoint
CREATE TRIGGER immutable_sb_adjustments_UPDATE BEFORE UPDATE ON sb_adjustments BEGIN SELECT RAISE(ABORT,'Append-only ledger and audit'); END;

--> statement-breakpoint
CREATE TRIGGER immutable_sb_adjustments_DELETE BEFORE DELETE ON sb_adjustments BEGIN SELECT RAISE(ABORT,'Append-only ledger and audit'); END;
