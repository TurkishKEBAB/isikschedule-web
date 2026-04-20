import pandas as pd
import os

# Find most recent xlsx file
uploads_dir = "uploads"
xlsx_files = [f for f in os.listdir(uploads_dir) if f.endswith('.xlsx')]
if xlsx_files:
    latest_file = os.path.join(uploads_dir, xlsx_files[0])
    print(f"Reading: {latest_file}")
    
    df = pd.read_excel(latest_file)
    print(f"Columns: {list(df.columns)}")
    
    # Find code column
    code_col = None
    for col in df.columns:
        if 'kod' in col.lower() or 'code' in col.lower():
            code_col = col
            break
    
    if code_col:
        codes = df[code_col].astype(str).tolist()
        soft = [c for c in codes if 'soft3215' in c.lower()]
        print(f"\nSOFT3215 courses found: {len(soft)}")
        for c in soft:
            print(f"  - {c}")
    else:
        print("No code column found")
else:
    print("No xlsx files found")
