import pandas as pd
from datetime import datetime
from app.db import SessionLocal
from app.db.models.ranking import App, Keyword, RankingHistory

APP_NAME = "Editly: Order Editing"
APP_URL = "https://apps.shopify.com/editly-order-editing"

session = SessionLocal()

app = session.query(App).filter_by(url=APP_URL).first()

if app is None:
    app = App(name=APP_NAME, url=APP_URL)
    session.add(app)
    session.commit()
    session.refresh(app)

df = pd.read_excel(
    r"C:\Users\Admin\Downloads\editly tracking .xlsx",
    header=None,
)

rows = df.shape[0]
cols = df.shape[1]

for r in range(rows):

    date_columns = []

    for c in range(1, cols):
        value = df.iloc[r, c]

        if isinstance(value, datetime) or (
            isinstance(value, str) and "/" in value
        ):
            date_columns.append(c)

    if not date_columns:
        continue

    keyword_start = None

    for rr in range(r + 1, min(r + 6, rows)):
        if str(df.iloc[rr, 1]).strip() == "Keyword Position":
            keyword_start = rr + 2
            break

    if keyword_start is None:
        continue

    keyword_end = keyword_start

    while keyword_end < rows:
        value = df.iloc[keyword_end, 0]

        if pd.isna(value):
            break

        keyword_end += 1

    for c in date_columns:

        tracked_date = pd.to_datetime(df.iloc[r, c], dayfirst=True)

        for kr in range(keyword_start, keyword_end):

            keyword_name = str(df.iloc[kr, 0]).strip()

            rank = df.iloc[kr, c]

            if pd.isna(rank):
                continue

            keyword = session.query(Keyword).filter_by(name=keyword_name).first()

            if keyword is None:
                keyword = Keyword(name=keyword_name)
                session.add(keyword)
                session.flush()

            if keyword not in app.keywords:
                app.keywords.append(keyword)

            exists = (
                session.query(RankingHistory)
                .filter_by(
                    app_id=app.id,
                    keyword_id=keyword.id,
                    tracked_date=tracked_date,
                )
                .first()
            )

            if exists:
                continue

            session.add(
                RankingHistory(
                    app_id=app.id,
                    keyword_id=keyword.id,
                    rank=int(rank),
                    page=((int(rank) - 1) // 25) + 1,
                    found=True,
                    tracked_date=tracked_date,
                )
            )

session.commit()

print("Import completed successfully.")