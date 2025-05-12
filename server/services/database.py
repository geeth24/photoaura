# db_config.py
import psycopg
import os
from routers.auth.auth_router import get_password_hash

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

    # create an album table, incldues name, slug, location, date, image_count, shared, upload, face_detection
    cursor.execute(
        "CREATE TABLE IF NOT EXISTS album (id SERIAL PRIMARY KEY, name VARCHAR(255), slug VARCHAR(255), location VARCHAR(255), date VARCHAR(255), image_count INT, shared BOOLEAN, upload BOOLEAN, secret VARCHAR(255), face_detection BOOLEAN);"
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
    # create a new table for categories save name, slug
    cursor.execute(
        "CREATE TABLE IF NOT EXISTS categories (id SERIAL PRIMARY KEY, name VARCHAR(255), slug VARCHAR(255))"
    )
    # create a new table for album categories save album_id, category_id
    cursor.execute(
        """
    CREATE TABLE IF NOT EXISTS album_categories (
        id SERIAL PRIMARY KEY,
        album_id INT UNIQUE,  
        category_id INT UNIQUE, 
        FOREIGN KEY (album_id) REFERENCES album(id),
        FOREIGN KEY (category_id) REFERENCES categories(id)
    );
    """
    )
    db.commit()
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS face_data (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) DEFAULT NULL,
            external_id VARCHAR(255) UNIQUE 
        );
        """
    )
    cursor.execute(
        """
    CREATE TABLE IF NOT EXISTS photo_face_link (
        id SERIAL PRIMARY KEY,
        photo_id INT,
        face_id VARCHAR(255),
        album_id INT,
        FOREIGN KEY (photo_id) REFERENCES file_metadata(id),
        FOREIGN KEY (face_id) REFERENCES face_data(external_id), -- Linking to the external_id
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

    # Booking table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS bookings (
            id SERIAL PRIMARY KEY,
            client_name VARCHAR(255),
            client_email VARCHAR(255),
            client_phone VARCHAR(50),
            preferred_date TIMESTAMP,
            additional_notes TEXT,
            status VARCHAR(50) DEFAULT 'pending',
            google_calendar_event_id VARCHAR(255),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)

    # Pricing table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS pricing (
            id SERIAL PRIMARY KEY,
            session_type VARCHAR(255),
            price DECIMAL(10,2),
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)

    # Videos table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS videos (
            id SERIAL PRIMARY KEY,
            client_id INT,
            title VARCHAR(255),
            s3_key VARCHAR(255),
            content_type VARCHAR(50),
            size BIGINT,
            upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (client_id) REFERENCES users(id)
        );
    """)

    # Video revisions table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS video_revisions (
            id SERIAL PRIMARY KEY,
            video_id INT,
            s3_key VARCHAR(255),
            version INT,
            upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            permanent_storage BOOLEAN DEFAULT FALSE,
            FOREIGN KEY (video_id) REFERENCES videos(id)
        );
    """)

    # Service types table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS service_types (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) UNIQUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)

    # Insert default service types if they don't exist
    cursor.execute("""
        INSERT INTO service_types (name) 
        VALUES ('photography'), ('videography'), ('both')
        ON CONFLICT (name) DO NOTHING;
    """)

    # Add service_type_id to bookings table if it doesn't exist
    cursor.execute("""
        ALTER TABLE bookings 
        ADD COLUMN IF NOT EXISTS service_type_id INT REFERENCES service_types(id);
    """)

    db.commit()
    cursor.close()


data_dir = "/var/aura/data"
