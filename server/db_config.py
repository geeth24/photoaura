# db_config.py
import psycopg

# Database connection details
host = "70.120.136.35"
dbname = "postgres"
user = "root"
user_password = "banna"

# host = "localhost"
# dbname = "postgres"
# user = "geeth"
# user_password = "postgres"


def get_db():
    db = psycopg.connect(host=host, dbname=dbname, user=user, password=user_password)
    cursor = db.cursor()
    return db, cursor


# Table setup
def create_table():
    db, cursor = get_db()
    cursor.execute(
        "CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, user_name VARCHAR(255), user_password VARCHAR(255), full_name VARCHAR(255), user_email VARCHAR(255))"
    )

    # create an album table, incldues name, location, date, image_count, shared
    cursor.execute(
        "CREATE TABLE IF NOT EXISTS album (id SERIAL PRIMARY KEY, name VARCHAR(255), location VARCHAR(255), date VARCHAR(255), image_count INT, shared BOOLEAN);"
    )

    # cursor.execute(
    #     "CREATE TABLE IF NOT EXISTS file_metadata (id SERIAL PRIMARY KEY, album_id INT, filename VARCHAR(255), content_type VARCHAR(50), size INT, upload_date TIMESTAMP, exif_data JSON, blur_data_url TEXT, FOREIGN KEY (album_id) REFERENCES album(id));"
    # )

    cursor.execute(
        "CREATE TABLE IF NOT EXISTS file_metadata (id SERIAL PRIMARY KEY, album_id INT, filename VARCHAR(255), content_type VARCHAR(50), size INT, width INT, height INT, upload_date TIMESTAMP, exif_data JSON, blur_data_url TEXT, FOREIGN KEY (album_id) REFERENCES album(id));"
    )
    db.commit()
    cursor.close()


data_dir = "/var/aura/data"
