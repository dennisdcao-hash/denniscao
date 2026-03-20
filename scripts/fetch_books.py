"""Fetch Goodreads RSS feeds and write books.json for the site."""

import json
import os
import urllib.request
import xml.etree.ElementTree as ET

USER_ID = "154870940"
FEED_BASE = f"https://www.goodreads.com/review/list_rss/{USER_ID}"


def parse_items(xml_bytes):
    root = ET.fromstring(xml_bytes)
    books = []
    for item in root.findall(".//item"):
        def get(tag, _item=item):
            el = _item.find(tag)
            return el.text.strip() if el is not None and el.text else ""

        cover = get("book_large_image_url") or get("book_medium_image_url") or get("book_small_image_url")
        # num_pages is nested inside <book><num_pages>
        book_el = item.find("book")
        pages_el = book_el.find("num_pages") if book_el is not None else None
        pages_str = pages_el.text.strip() if pages_el is not None and pages_el.text else ""
        rating_str = get("user_rating")
        read_at = get("user_read_at")

        books.append({
            "title": get("title"),
            "author": get("author_name"),
            "cover": cover,
            "pages": int(pages_str) if pages_str.isdigit() else 0,
            "rating": int(rating_str) if rating_str.isdigit() else 0,
            "link": get("link") or get("guid"),
            "readAt": read_at if read_at else None,
        })
    return books


def fetch_shelf(shelf):
    all_books = []
    page = 1
    while True:
        url = f"{FEED_BASE}?shelf={shelf}&page={page}"
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req) as resp:
            xml_bytes = resp.read()
        books = parse_items(xml_bytes)
        if not books:
            break
        all_books.extend(books)
        page += 1
    return all_books


def download_covers(books):
    os.makedirs("covers", exist_ok=True)
    for book in books:
        if not book["cover"]:
            continue
        # Use book_id from the link as filename
        book_id = book["link"].split("/show/")[1].split("?")[0] if "/show/" in book["link"] else None
        if not book_id:
            continue
        ext = ".jpg"
        local_path = f"covers/{book_id}{ext}"
        if os.path.exists(local_path):
            continue
        try:
            req = urllib.request.Request(book["cover"], headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req) as resp:
                with open(local_path, "wb") as f:
                    f.write(resp.read())
        except Exception as e:
            print(f"  Failed to download cover for {book['title']}: {e}")


def main():
    currently_reading = fetch_shelf("currently-reading")
    read = fetch_shelf("read")
    all_books = currently_reading + read
    print(f"Wrote {len(currently_reading)} currently reading, {len(read)} read")
    print(f"Downloading {len(all_books)} covers...")
    download_covers(all_books)
    data = {
        "currentlyReading": currently_reading,
        "read": read,
    }
    with open("books.json", "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


if __name__ == "__main__":
    main()
