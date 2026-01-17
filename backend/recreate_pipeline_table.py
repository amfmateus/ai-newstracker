from database import engine, Base
from models import ReportPipeline
from sqlalchemy import text

def recreate_table():
    print("Dropping report_pipelines table...")
    with engine.connect() as conn:
        conn.execute(text("DROP TABLE IF EXISTS report_pipelines"))
        conn.commit()
    
    print("Table dropped. Next run of create_all will recreate it.")

if __name__ == "__main__":
    recreate_table()
