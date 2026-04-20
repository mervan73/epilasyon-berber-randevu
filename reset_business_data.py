import pyodbc

SERVER = r'DESKTOP-T20P6DA\SQLEXPRESS'
DATABASE = 'BerberRandevu'
CONN_STR = f'DRIVER={{SQL Server}};SERVER={SERVER};DATABASE={DATABASE};Trusted_Connection=yes;'

TABLES = [
    'randevular',
    'hizmetler',
    'calisanlar',
    'calisma_saatleri',
    'tatil_gunleri',
    'isletmeler',
]


def main():
    conn = pyodbc.connect(CONN_STR, timeout=10)
    cur = conn.cursor()
    for table in TABLES:
        try:
            cur.execute(f"DELETE FROM {table}")
            print(f"Cleared: {table}")
        except Exception as exc:
            print(f"Skipped {table}: {exc}")
    conn.commit()
    conn.close()
    print("Business-related data cleared. 'kullanicilar' was left untouched.")


if __name__ == '__main__':
    main()
