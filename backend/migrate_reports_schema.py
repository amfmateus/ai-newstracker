import sqlite3

def migrate():
    conn = sqlite3.connect('news_aggregator.db')
    cursor = conn.cursor()
    
    columns = [
        ("meta_duration_ms", "INTEGER"),
        ("meta_model", "VARCHAR"),
        ("meta_tokens_in", "INTEGER"),
        ("meta_tokens_out", "INTEGER"),
        ("meta_prompt", "TEXT")
    ]
    
    print("Checking 'reports' table schema...")
    cursor.execute("PRAGMA table_info(reports)")
    existing_cols = {row[1] for row in cursor.fetchall()}
    
    for col_name, col_type in columns:
        if col_name not in existing_cols:
            print(f"Adding column: {col_name} ({col_type})")
            try:
                cursor.execute(f"ALTER TABLE reports ADD COLUMN {col_name} {col_type}")
            except Exception as e:
                print(f"Error adding {col_name}: {e}")
        else:
            print(f"Column {col_name} already exists.")
            
    conn.commit()
    conn.close()
    print("Migration complete.")

if __name__ == "__main__":
    migrate()
