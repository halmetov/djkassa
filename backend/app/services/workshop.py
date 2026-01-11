from __future__ import annotations

from sqlalchemy.orm import Session

from app.models import Branch

WORKSHOP_NAME = "Цех"


def get_workshop_branch_id(db: Session) -> int:
    """Return the workshop branch id, creating or marking it if necessary."""
    branch = (
        db.query(Branch)
        .filter((Branch.is_workshop.is_(True)) | (Branch.name == WORKSHOP_NAME))
        .order_by(Branch.is_workshop.desc())
        .first()
    )
    if branch:
        if not branch.is_workshop:
            branch.is_workshop = True
            db.commit()
            db.refresh(branch)
        return branch.id

    branch = Branch(name=WORKSHOP_NAME, active=True, is_workshop=True)
    db.add(branch)
    db.commit()
    db.refresh(branch)
    return branch.id
