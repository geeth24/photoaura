"""Make watermarked proofs of earlier photo versions in locked albums, so
clients can compare edits before the final payment.

    python -m scripts.version_proofs [slug ...]     # no slugs: every locked album
"""

import sys

from db.base import session_scope
from db.models import Album
from services.proof_service import version_proofs


def main(slugs):
    with session_scope() as s:
        q = s.query(Album.id, Album.slug).filter(Album.proof_locked.is_(True))
        if slugs:
            q = q.filter(Album.slug.in_(slugs))
        albums = q.all()
    for album_id, slug in albums:
        print(f"{slug}: {version_proofs(album_id)} version proofs made", flush=True)


if __name__ == "__main__":
    main(sys.argv[1:])
