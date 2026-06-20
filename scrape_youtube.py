import sys
import html
from pathlib import Path
from urllib.parse import quote

from playwright.sync_api import sync_playwright


def scrape_youtube_top5(query: str) -> list[dict]:
    search_url = f"https://www.youtube.com/results?search_query={quote(query)}"

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        page.goto(search_url, wait_until="domcontentloaded")
        page.wait_for_selector("ytd-video-renderer", timeout=15_000)

        videos = page.eval_on_selector_all(
            "ytd-video-renderer",
            """
            cards => cards.slice(0, 5).map(card => {
                const titleEl = card.querySelector("#video-title");
                const thumbEl = card.querySelector("img");
                const metaLines = card.querySelectorAll("#metadata-line span");

                return {
                    title: titleEl?.textContent?.trim() || "",
                    url: titleEl?.href || "",
                    thumbnail: thumbEl?.src || thumbEl?.getAttribute("src") || "",
                    views: metaLines?.[0]?.textContent?.trim() || "N/A",
                };
            })
            """,
        )

        browser.close()

    return videos


def build_html(query: str, videos: list[dict]) -> str:
    cards = []
    for v in videos:
        title = html.escape(v["title"])
        url = html.escape(v["url"])
        thumbnail = html.escape(v["thumbnail"])
        views = html.escape(v["views"])

        cards.append(f"""
        <div class="card">
          <a href="{url}" target="_blank" rel="noopener noreferrer">
            <img src="{thumbnail}" alt="{title}">
          </a>
          <h3>{title}</h3>
          <p>{views}</p>
        </div>
        """)

    cards_html = "\n".join(cards)
    safe_query = html.escape(query)

    return f"""<!doctype html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>YouTube Top 5 for "{safe_query}"</title>
  <style>
    body {{ font-family: Arial, sans-serif; margin: 24px; background: #f7f7f7; }}
    h1 {{ margin-bottom: 20px; }}
    .grid {{
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 16px;
    }}
    .card {{
      background: white;
      border-radius: 10px;
      padding: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,.08);
    }}
    img {{ width: 100%; border-radius: 8px; }}
    h3 {{ font-size: 16px; margin: 10px 0 6px; }}
    p {{ color: #666; margin: 0; }}
  </style>
</head>
<body>
  <h1>Top 5 YouTube Results for "{safe_query}"</h1>
  <div class="grid">{cards_html}</div>
</body>
</html>"""


def main():
    query = sys.argv[1] if len(sys.argv) > 1 else "AI coding tutorials"
    videos = scrape_youtube_top5(query)

    if not videos:
        raise RuntimeError("No videos found. YouTube markup may have changed.")

    output_path = Path("output.html")
    output_path.write_text(build_html(query, videos), encoding="utf-8")
    print(f"Created {output_path.resolve()}")


if __name__ == "__main__":
    main()