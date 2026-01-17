import sqlite3

def migrate():
    conn = sqlite3.connect('news_aggregator.db')
    cursor = conn.cursor()
    
    columns = [
        ("pdf_crawl_model", "VARCHAR", "'gemini-2.5-flash-lite'"),
        ("pdf_crawl_prompt", "TEXT", "NULL")
    ]
    
    print("Checking 'system_config' table schema...")
    cursor.execute("PRAGMA table_info(system_config)")
    existing_cols = {row[1] for row in cursor.fetchall()}
    
    for col_name, col_type, default_val in columns:
        if col_name not in existing_cols:
            print(f"Adding column: {col_name} ({col_type})")
            try:
                # Add column. Default value syntax might vary, keeping simple since it's sqlite
                # For SQLite, we can user DEFAULT in ALTER TABLE
                sql = f"ALTER TABLE system_config ADD COLUMN {col_name} {col_type}"
                if default_val != "NULL":
                    sql += f" DEFAULT {default_val}"
                
                cursor.execute(sql)
            except Exception as e:
                print(f"Error adding {col_name}: {e}")
        else:
            print(f"Column {col_name} already exists.")
            
    conn.commit()
    conn.close()
    print("PDF Config Migration complete.")

if __name__ == "__main__":
    migrate()
