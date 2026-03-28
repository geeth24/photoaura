from psycopg_pool import ConnectionPool
from contextlib import contextmanager
from config import settings
import bcrypt

pool = ConnectionPool(
    conninfo=f"host={settings.POSTGRES_HOST} dbname={settings.POSTGRES_DB} user={settings.POSTGRES_USER} password={settings.POSTGRES_PASSWORD}",
    min_size=2,
    max_size=10,
)


def get_password_hash(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


@contextmanager
def get_db():
    conn = pool.getconn()
    cursor = conn.cursor()
    try:
        yield conn, cursor
    finally:
        cursor.close()
        pool.putconn(conn)


def create_table():
    root_password = get_password_hash(settings.ROOT_PASSWORD)

    with get_db() as (db, cursor):
        cursor.execute(
            "CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, user_name VARCHAR(255), user_password VARCHAR(255), full_name VARCHAR(255), user_email VARCHAR(255))"
        )

        cursor.execute(
            "CREATE TABLE IF NOT EXISTS album (id SERIAL PRIMARY KEY, name VARCHAR(255), slug VARCHAR(255), location VARCHAR(255), date VARCHAR(255), image_count INT, shared BOOLEAN, upload BOOLEAN, secret VARCHAR(255), face_detection BOOLEAN);"
        )

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
        cursor.execute(
            "CREATE TABLE IF NOT EXISTS categories (id SERIAL PRIMARY KEY, name VARCHAR(255), slug VARCHAR(255))"
        )
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
                FOREIGN KEY (face_id) REFERENCES face_data(external_id),
                FOREIGN KEY (album_id) REFERENCES album(id)
            );
            """
        )
        db.commit()

        cursor.execute(
            "SELECT * FROM users WHERE user_name = %s", (settings.ROOT_USER,)
        )
        if cursor.rowcount == 0:
            cursor.execute(
                "INSERT INTO users (user_name, user_password, full_name, user_email) VALUES (%s, %s, %s, %s)",
                (
                    settings.ROOT_USER,
                    root_password,
                    settings.ROOT_FULL_NAME,
                    settings.ROOT_EMAIL,
                ),
            )
            db.commit()

        cursor.execute(
            """
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
        """
        )

        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS pricing (
                id SERIAL PRIMARY KEY,
                session_type VARCHAR(255),
                price DECIMAL(10,2),
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """
        )

        cursor.execute(
            """
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
        """
        )

        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS video_revisions (
                id SERIAL PRIMARY KEY,
                video_id INT,
                s3_key VARCHAR(255),
                version INT,
                upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                permanent_storage BOOLEAN DEFAULT FALSE,
                FOREIGN KEY (video_id) REFERENCES videos(id)
            );
        """
        )

        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS service_types (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) UNIQUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """
        )

        cursor.execute(
            """
            INSERT INTO service_types (name)
            VALUES ('photography'), ('videography'), ('both')
            ON CONFLICT (name) DO NOTHING;
        """
        )

        cursor.execute(
            """
            ALTER TABLE bookings
            ADD COLUMN IF NOT EXISTS service_type_id INT REFERENCES service_types(id);
        """
        )

        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS event_types (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) UNIQUE,
                priority INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """
        )

        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS events (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                event_type_id INT REFERENCES event_types(id),
                event_date TIMESTAMP NOT NULL,
                location VARCHAR(255),
                description TEXT,
                created_by INT REFERENCES users(id),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """
        )

        db.commit()


data_dir = settings.DATA_DIR
