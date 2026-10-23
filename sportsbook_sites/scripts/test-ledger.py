import sqlite3,json,time,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
class Ledger(unittest.TestCase):
 def setUp(self):
  self.c=sqlite3.connect(':memory:');self.c.row_factory=sqlite3.Row
  for file in sorted((ROOT/'drizzle').glob('*.sql')):self.c.executescript(file.read_text())
  self.t=int(time.time());self.c.execute("INSERT INTO sb_users VALUES('owner','anton','hash','admin',1,100000,NULL,?)",(self.t,))
  self.c.execute("INSERT INTO sb_invites VALUES('invite',?,NULL,100000)",(self.t+100,));self.c.execute("INSERT INTO sb_users VALUES('friend','friend','hash','member',1,100000,'invite',?)",(self.t,))
  self.c.execute("INSERT INTO sb_events VALUES('e','nfl','Away @ Home',?,'scheduled','source',?,'{}')",(self.t+3600,self.t))
  self.c.execute("INSERT INTO sb_quotes VALUES('q','e','moneyline','Home',100,NULL,'home',NULL,'full','source',?,?,?,?,0,0,1)",(self.t,self.t,self.t+120,self.t+3600));self.c.commit()
 def balance(self,uid):return self.c.execute("SELECT coalesce(sum(delta),0) FROM sb_postings WHERE account=?",('member:'+uid,)).fetchone()[0]
 def pick(self,key='key',stake=10000):self.c.execute("INSERT INTO sb_picks VALUES(?, 'friend','q','e','Away @ Home','Home',100,?,?,?,?,'{}','pending')",(key,stake,stake*2,key,self.t))
 def result(self,status='win',payout=20000,version=1):self.c.execute("INSERT INTO sb_settlements(pick_id,version,status,payout,source,payload,created_at) VALUES('key',?,?,?,'official','{}',?)",(version,status,payout,self.t))
 def test_invite_and_owner(self):
  for sql in ["INSERT INTO sb_users VALUES('intruder','intruder','x','admin',1,0,NULL,1)","INSERT INTO sb_users VALUES('bad','bad','x','member',1,0,'invite',1)"]:
   with self.assertRaises(sqlite3.IntegrityError):self.c.execute(sql)
 def test_balanced_acceptance(self):
  self.pick();self.assertEqual(self.balance('friend'),90000);self.assertEqual(self.balance('owner'),100000);self.assertEqual(self.c.execute('SELECT sum(delta) FROM sb_postings').fetchone()[0],0)
 def test_retry_no_double_debit(self):
  self.pick()
  with self.assertRaises(sqlite3.IntegrityError):self.pick()
  self.assertEqual(self.balance('friend'),90000)
 def test_no_negative_balance(self):
  self.pick(stake=90000)
  with self.assertRaises(sqlite3.IntegrityError):self.pick('two',20000)
  self.assertEqual(self.balance('friend'),10000)
 def test_freshness_suspension_and_closure(self):
  for field,value in [('source_at',0),('received_at',0),('expires_at',0),('closes_at',0),('suspended',1),('licensed',0)]:
   self.c.execute('SAVEPOINT case1');self.c.execute(f'UPDATE sb_quotes SET {field}=?',(value,))
   with self.assertRaises(sqlite3.IntegrityError):self.pick()
   self.c.execute('ROLLBACK TO case1');self.c.execute('RELEASE case1')
 def test_settlement_and_correction(self):
  self.pick();self.result();self.assertEqual(self.balance('friend'),110000)
  with self.assertRaises(sqlite3.IntegrityError):self.result()
  self.result('loss',0,2);self.assertEqual(self.balance('friend'),90000);self.assertEqual(self.c.execute('SELECT sum(delta) FROM sb_postings').fetchone()[0],0)
 def test_push_void(self):
  self.pick();self.result('push',10000);self.assertEqual(self.balance('friend'),100000)
  self.result('void',10000,2);self.assertEqual(self.balance('friend'),100000)
 def test_immutable(self):
  self.pick()
  for sql in ["UPDATE sb_picks SET odds=200","DELETE FROM sb_picks","DELETE FROM sb_postings","UPDATE sb_audit SET action='x'"]:
   with self.assertRaises(sqlite3.IntegrityError):self.c.execute(sql)
 def test_disabled(self):
  self.c.execute("UPDATE sb_users SET enabled=0 WHERE id='friend'")
  with self.assertRaises(sqlite3.IntegrityError):self.pick()
 def test_adjustments(self):
  self.c.execute("INSERT INTO sb_adjustments VALUES('adjust','owner','friend',5000,'grant',?)",(self.t,));self.assertEqual(self.balance('friend'),105000);self.assertEqual(self.c.execute('SELECT sum(delta) FROM sb_postings').fetchone()[0],0)
 def test_permission_guard(self):
  self.c.execute("INSERT INTO sb_sessions VALUES('session','friend','csrf',?)",(self.t+100,));self.c.execute("INSERT INTO sb_guards VALUES('g','session','member')")
  with self.assertRaises(sqlite3.IntegrityError):self.c.execute("INSERT INTO sb_guards VALUES('a','session','admin')")
if __name__=='__main__':unittest.main()
