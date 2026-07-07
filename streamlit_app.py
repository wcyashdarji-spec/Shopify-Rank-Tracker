import os
import requests
import pandas as pd
import altair as alt
from datetime import date
import streamlit as st
from dotenv import load_dotenv
load_dotenv()

st.set_page_config(
    page_title="Rank Tracker Dashboard",
    page_icon="📊",
    layout="wide",
    initial_sidebar_state="expanded",
)

st.markdown("# Rank Tracker Dashboard")
st.markdown(
    "Use the sidebar to connect to the backend, select an app, choose keywords, and explore ranking history over time."
)
st.markdown("---")

api_base = os.getenv("API_BASE_URL")

st.sidebar.text_input(
    "API base URL",
    value=api_base,
    disabled=True,
)

st.sidebar.title("Tracker controls")
st.sidebar.write(
    "1. Set your API base URL.\n"
    "2. Pick an app and the keywords you want to inspect.\n"
    "3. Choose a date range and click **Load history**."
)


with st.expander("Track a new app", expanded=True):
    st.markdown("### Submit a new app for tracking")
    st.write(
        "Provide the app name, URL, and keywords you want to track. "
        "Enter one keyword per line."
    )

    with st.form("track_app_form"):
        new_app_name = st.text_input("App name", key="new_app_name")
        new_app_url = st.text_input("App URL", key="new_app_url")
        new_keywords = st.text_area(
            "Keywords",
            placeholder="order editing\nediting\neditly\nedit order\n...",
            height=180,
            key="new_keywords"
        )
        st.markdown(
            "Enter keywords one per line. The tracker will search each keyword on Shopify."
        )

        track_button = st.form_submit_button("Track this app now")

    if track_button:
        if not new_app_name.strip() or not new_app_url.strip() or not new_keywords.strip():
            st.error("Please provide the app name, app URL, and at least one keyword.")
        else:
            keywords_list = [
                kw.strip()
                for kw in new_keywords.replace(",", "\n").splitlines()
                if kw.strip()
            ]
            payload = {
                "apps": [
                    {
                        "name": new_app_name.strip(),
                        "url": new_app_url.strip(),
                        "keywords": keywords_list,
                    }
                ]
            }
            try:
                with st.spinner("Submitting your tracking request. This may take several minutes..."):
                    response = requests.post(
                        f"{api_base}/tracker/run",
                        json=payload,
                        headers={"Content-Type": "application/json"},
                        timeout=600,
                    )
                if response.status_code == 200:
                    st.success("Tracking request submitted successfully.")
                    st.json(response.json())
                else:
                    st.error(f"Tracker request failed: {response.status_code}")
                    st.text(response.text)
            except requests.ReadTimeout:
                st.error(
                    "The tracker request timed out after 5 minutes. "
                    "The backend may still be processing — check API logs or retry later."
                )
            except requests.RequestException as exc:
                st.error(f"Failed to reach API: {exc}")

if not api_base:
    st.sidebar.error("Please provide the API base URL (e.g. http://localhost:8001)")
    st.stop()

apps_resp = requests.get(f"{api_base}/tracker/apps")
if apps_resp.status_code != 200:
    st.sidebar.error(f"Failed to fetch apps: {apps_resp.status_code} {apps_resp.text}")
    st.stop()

apps_json = apps_resp.json().get("apps", [])
app_options = {f"{a['name']} ({a['id']})": a for a in apps_json}
if not apps_json:
    st.warning("No apps available in the backend. Use the tracker form above to add one.")

with st.expander("Manage keywords for an existing app", expanded=True):
    st.markdown("### Add or remove keywords for a tracked app")
    st.write(
        "Select an app below to remove current keywords or add new ones. "
        "Enter one keyword per line when adding new keywords."
    )

    selected_app_label_mgmt = st.selectbox(
        "Select app to manage keywords",
        options=list(app_options.keys()) if app_options else [],
        key="select_app_manage",
    )

    if selected_app_label_mgmt:
        selected_app_mgmt = app_options[selected_app_label_mgmt]
        st.markdown(f"#### Current keywords for {selected_app_mgmt['name']}")

        current_keywords = selected_app_mgmt.get("keywords", [])
        if current_keywords:
            kw_cols = st.columns([4, 2])
            kw_cols[0].markdown("**Keyword**")
            kw_cols[1].markdown("**Remove**")

            for keyword in current_keywords:
                keyword_name = keyword.get("name")
                keyword_id = keyword.get("id")
                cols = st.columns([4, 1])
                cols[0].write(keyword_name)
                if cols[1].button(
                    f"Remove {keyword_id}",
                    key=f"remove_kw_{selected_app_mgmt['id']}_{keyword_id}",
                ):
                    try:
                        resp = requests.delete(
                            f"{api_base}/tracker/apps/{selected_app_mgmt['id']}/keywords/{keyword_id}",
                            timeout=30,
                        )
                        if resp.status_code == 200:
                            st.success(f"Removed keyword '{keyword_name}' from app.")
                            st.rerun()
                        else:
                            st.error(f"Failed to remove keyword: {resp.status_code} {resp.text}")
                    except requests.RequestException as exc:
                        st.error(f"Failed to remove keyword: {exc}")
        else:
            st.info("This app has no associated keywords.")

        with st.form("add_keywords_form"):
            new_keywords_input = st.text_area(
                "Add keyword(s)",
                placeholder="order editing\nediting\n...",
                height=140,
                key="new_keywords_manage",
            )
            add_keywords_button = st.form_submit_button("Add keywords")

        if add_keywords_button:
            keywords_list = [
                kw.strip()
                for kw in new_keywords_input.replace(",", "\n").splitlines()
                if kw.strip()
            ]

            if not keywords_list:
                st.error("Enter at least one keyword to add.")
            else:
                try:
                    resp = requests.post(
                        f"{api_base}/tracker/apps/{selected_app_mgmt['id']}/keywords",
                        json={"keywords": keywords_list},
                        headers={"Content-Type": "application/json"},
                        timeout=30,
                    )
                    if resp.status_code == 200:
                        st.success("Keywords added successfully.")
                        st.rerun()
                    else:
                        st.error(f"Failed to add keywords: {resp.status_code} {resp.text}")
                except requests.RequestException as exc:
                    st.error(f"Failed to add keywords: {exc}")

st.markdown("## Load ranking history")
st.write("Select an app, choose keyword(s), and select a date range to load ranking history.")

selected_app_label = st.selectbox(
    "Select app",
    options=list(app_options.keys()) if app_options else [],
    key="select_app_main",
)

selected_app = None
kw_options = {}
selected_kw_labels = []

if 'history_rows' not in st.session_state:
    st.session_state['history_rows'] = None

if selected_app_label:
    selected_app = app_options[selected_app_label]
    keywords = selected_app.get("keywords", [])
    for idx, k in enumerate(keywords, start=1):
        if isinstance(k, dict):
            label = f"{k.get('name', 'Unknown')} ({k.get('id', idx)})"
            kw_options[label] = k
        else:
            label = f"{k} ({idx})"
            kw_options[label] = {"id": idx, "name": k}

    keyword_labels = list(kw_options.keys())

    selected_kw_labels = st.multiselect(
        "Select keyword(s)",
        options=list(kw_options.keys()),
        default=keyword_labels[:5],
        key="selected_keywords",
    )

st.markdown("---")

today = date.today()
start_default = today.replace(day=1)
end_default = today

date_selection = st.date_input(
    "Date range",
    value=(start_default, end_default),
    key="history_date_range",
)

if isinstance(date_selection, (tuple, list)):
    if len(date_selection) == 2:
        start_date, end_date = date_selection
    elif len(date_selection) == 1:
        start_date = end_date = date_selection[0]
    else:
        start_date = end_date = today
else:
    start_date = end_date = date_selection

# if selected_app:
    # selected_app_info = st.container()
    # with selected_app_info:
    #     st.markdown("**Selected app**")
    #     st.write(selected_app['name'])
    #     st.write(selected_app['url'])
    #     st.write(f"Keywords available: {len(kw_options)}")

load_history = st.button("Load history")

history_rows = st.session_state.history_rows

if load_history:
    if not selected_app:
        st.error("Pick an app first.")
    elif not selected_kw_labels:
        st.error("Pick at least one keyword.")
    else:
        app_id = selected_app['id']
        selected_keywords = [kw_options[label] for label in selected_kw_labels]
        keyword_ids = [kw['id'] for kw in selected_keywords]

        params = {
            "days": 3650,
            "keyword_ids": keyword_ids,
        }

        hist_resp = requests.get(
            f"{api_base}/tracker/history/{app_id}",
            params=params,
            timeout=30,
        )

        if hist_resp.status_code != 200:
            st.error(f"Failed to fetch history: {hist_resp.status_code} {hist_resp.text}")
        else:
            data = hist_resp.json()
            selected_keyword_ids = set(keyword_ids)
            keywords = [
                kw for kw in data.get('keywords', [])
                if kw.get('keyword', {}).get('id') in selected_keyword_ids
            ]

            if not keywords:
                st.info("No history records found for the selected keywords.")
            else:
                rows = []
                for kw_data in keywords:
                    kw_name = kw_data.get('keyword', {}).get('name', 'Unknown')
                    for r in kw_data.get('history', []):
                        rows.append(
                            {
                                "keyword": kw_name,
                                "rank": r.get('rank'),
                                "page": r.get('page'),
                                "found": r.get('found'),
                                "screenshot_path": r.get('screenshot_path'),
                                "tracked_date": r.get('tracked_date'),
                            }
                        )

                st.session_state.history_rows = rows
                history_rows = rows

if history_rows:
    df = pd.DataFrame(history_rows)
    df['tracked_date'] = pd.to_datetime(
        df['tracked_date'],
        format="ISO8601",
        errors="coerce",
    )

    mask = (
        (df['tracked_date'].dt.date >= start_date) &
        (df['tracked_date'].dt.date <= end_date)
    )
    df = df.loc[mask].sort_values(['keyword', 'tracked_date'])

    if df.empty:
        st.info("No records in the selected date range.")
    else:
        chart_df = df.dropna(subset=['rank']).copy()
        if chart_df.empty:
            st.warning("No numeric rank values to plot (all records are missing rank).")
        else:
            chart_df['tracked_date'] = pd.to_datetime(
                chart_df['tracked_date'],
                errors='coerce',
            )
            title = (
                f"Rank over time — {selected_app['name']}"
                if len(selected_kw_labels) == 1
                else f"Rank over time — {selected_app['name']} / {', '.join([kw_options[label]['name'] for label in selected_kw_labels])}"
            )

            available_windows = {
                "7 days": 7,
                "30 days": 30,
                "3 months": 90,
                "6 months": 180,
                "12 months": 365,
            }
            selected_stat_windows = st.multiselect(
                "Choose average windows",
                options=list(available_windows.keys()),
                default=[],
                key="average_windows",
                help="Select windows to calculate average rank for the loaded history.",
            )

            stats = []
            now = pd.Timestamp.now()
            for label in selected_stat_windows:
                days = available_windows[label]
                window_df = chart_df[chart_df['tracked_date'] >= now - pd.Timedelta(days=days)]
                avg_rank = window_df['rank'].mean()
                stats.append(
                    {
                        "label": label,
                        "average_rank": round(avg_rank, 2) if not pd.isna(avg_rank) else None,
                        "count": len(window_df),
                    }
                )

            if stats:
                stat_cols = st.columns(len(stats))
                for col, stat in zip(stat_cols, stats):
                    avg_text = f"{stat['average_rank']:.2f}" if stat['average_rank'] is not None else "-"
                    col.metric(stat['label'], avg_text, f"{stat['count']} records")

            chart = alt.Chart(chart_df).mark_line(point=True).encode(
                x=alt.X('tracked_date:T', title='Date', axis=alt.Axis(format='%b %d')),
                y=alt.Y('rank:Q', title='Rank', scale=alt.Scale(reverse=True)),
                color=alt.Color('keyword:N', title='Keyword'),
                tooltip=[
                    alt.Tooltip('tracked_date:T', title='Date', format='%Y-%m-%d %H:%M'),
                    alt.Tooltip('keyword:N', title='Keyword'),
                    alt.Tooltip('rank:Q', title='Rank'),
                    alt.Tooltip('page:Q', title='Page'),
                    alt.Tooltip('found:N', title='Found'),
                ],
            ).properties(
                width=1000,
                height=450,
                title=title,
            ).interactive()

            st.markdown("### Ranking trend")
            st.altair_chart(chart, use_container_width=True)

        total_records = len(df)
        first_date = df['tracked_date'].min().date().isoformat()
        last_date = df['tracked_date'].max().date().isoformat()

        metric_cols = st.columns(3)
        metric_cols[0].metric("Records", total_records)
        metric_cols[1].metric("First date", first_date)
        metric_cols[2].metric("Last date", last_date)

        st.markdown("### Raw data")
        st.dataframe(df.reset_index(drop=True))

