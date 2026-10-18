import sqlite3
import os

for dbpath in ['data/concord.db', 'packages/server/data/concord.db', '/var/lib/nuviovoice/concord.db']:
    if not os.path.exists(dbpath):
        continue
    con = sqlite3.connect(dbpath)
    cur = con.cursor()
    cur.execute("""
        UPDATE instance_settings 
        SET instance_name = 'Nuvio', 
            telemetry_enabled = 0, 
            telemetry_declined_version = '999.0.0' 
        WHERE id = 1
    """)
    con.commit()
    print(dbpath, cur.execute("SELECT id, instance_name, telemetry_enabled, telemetry_declined_version FROM instance_settings").fetchall())
    con.close()
