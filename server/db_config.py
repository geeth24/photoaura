# db_config.py
import psycopg
import os
from auth import get_password_hash

# Database connection details
host = os.environ.get("POSTGRES_HOST", "localhost")
dbname = os.environ.get("POSTGRES_DB", "aura")
user = os.environ.get("POSTGRES_USER", "aura")
user_password = os.environ.get("POSTGRES_PASSWORD", "aura")


root_user = os.environ.get("ROOT_USER", "root")
root_password = os.environ.get("ROOT_PASSWORD", "password")
root_password = get_password_hash(root_password)
root_email = os.environ.get("ROOT_EMAIL", "xxxx@xxxxxxxxx")
root_full_name = os.environ.get("ROOT_FULL_NAME", "root")

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

    # create an album table, incldues name, slug, location, date, image_count, shared, upload
    cursor.execute(
        "CREATE TABLE IF NOT EXISTS album (id SERIAL PRIMARY KEY, name VARCHAR(255), slug VARCHAR(255), location VARCHAR(255), date VARCHAR(255), image_count INT, shared BOOLEAN, upload BOOLEAN, secret VARCHAR(255))"
    )

    # cursor.execute(
    #     "CREATE TABLE IF NOT EXISTS file_metadata (id SERIAL PRIMARY KEY, album_id INT, filename VARCHAR(255), content_type VARCHAR(50), size INT, upload_date TIMESTAMP, exif_data JSON, blur_data_url TEXT, FOREIGN KEY (album_id) REFERENCES album(id));"
    # )

    cursor.execute(
        "CREATE TABLE IF NOT EXISTS file_metadata (id SERIAL PRIMARY KEY, album_id INT, filename VARCHAR(255), content_type VARCHAR(50), size INT, width INT, height INT, upload_date TIMESTAMP, exif_data JSON, blur_data_url TEXT, FOREIGN KEY (album_id) REFERENCES album(id));"
    )
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS user_album_permissions (
            id SERIAL PRIMARY KEY,
            user_id INT,
            album_id INT,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (album_id) REFERENCES album(id)
        );
        """
    )
    db.commit()

    cursor.execute("SELECT * FROM users WHERE user_name = %s", (root_user,))
    if cursor.rowcount == 0:
        cursor.execute(
            "INSERT INTO users (user_name, user_password, full_name, user_email) VALUES (%s, %s, %s, %s)",
            (root_user, root_password, root_full_name, root_email),
        )
        db.commit()

    cursor.close()
data_dir = "/var/aura/data"
