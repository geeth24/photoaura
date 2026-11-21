"""Re-render the proofs of proof-locked albums from their held originals.

    python -m scripts.refresh_proofs [slug ...]     # no slugs: every locked album
"""

import sys

from db.base import session_scope
from db.models import Album
from services.proof_service import refresh_proofs


def main(slugs):
    with session_scope() as s:
        q = s.query(Album.id, Album.slug).filter(Album.proof_locked.is_(True))
        if slugs:
            q = q.filter(Album.slug.in_(slugs))
        albums = q.all()
    for album_id, slug in albums:
        print(f"{slug}: {refresh_proofs(album_id)} proofs rewritten", flush=True)


if __name__ == "__main__":
    main(sys.argv[1:])
