"""
チャイドル - 子ども向けバーチャル試着アプリ
FastAPI バックエンドサーバー
"""

import io
import os
import base64
import asyncio
from pathlib import Path
from dotenv import load_dotenv
from PIL import Image
import pillow_heif
pillow_heif.register_heif_opener()

import uuid
import tempfile
import httpx
from fastapi import FastAPI, File, UploadFile, HTTPException, Query
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

app = FastAPI(title="チャイドル API", version="1.0.0")

# CORS設定（開発用）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# 設定
FASHN_API_KEY = os.getenv("FASHN_API_KEY", "")
RAKUTEN_APP_ID = os.getenv("RAKUTEN_APP_ID", "")
RAKUTEN_ACCESS_KEY = os.getenv("RAKUTEN_ACCESS_KEY", "")
RAKUTEN_AFFILIATE_ID = os.getenv("RAKUTEN_AFFILIATE_ID", "")
HF_TOKEN = os.getenv("HF_TOKEN", "")

FASHN_API_BASE = "https://api.fashn.ai/v1"
# 2022年版の新エンドポイント（accessKey認証が必須）
RAKUTEN_API_BASE = "https://openapi.rakuten.co.jp/ichibams/api/IchibaItem/Search/20220601"

# フロントエンド静的ファイルを配信
frontend_dir = Path(__file__).parent / "frontend"
app.mount("/static", StaticFiles(directory=str(frontend_dir / "static")), name="static")


@app.get("/")
async def root():
    """メイン画面を返す"""
    return FileResponse(str(frontend_dir / "index.html"))


# ─── 楽天API ───────────────────────────────────────────────

@app.get("/api/search-clothes")
async def search_clothes(
    keyword: str = Query(default="子供服", description="検索キーワード"),
    page: int = Query(default=1, ge=1, le=10),
):
    """楽天市場で子ども服を検索する"""
    if not RAKUTEN_APP_ID:
        raise HTTPException(status_code=500, detail="楽天APIのApp IDが設定されていません")
    if not RAKUTEN_ACCESS_KEY:
        raise HTTPException(status_code=500, detail="楽天APIのAccess Keyが設定されていません")

    params = {
        "applicationId": RAKUTEN_APP_ID,
        "accessKey": RAKUTEN_ACCESS_KEY,
        "keyword": f"{keyword} 子供服",
        "genreId": "100371",  # 楽天のキッズ・ベビー・マタニティジャンル
        "hits": 12,
        "page": page,
        "imageFlag": 1,
        "formatVersion": 2,
    }

    # アフィリエイトIDがある場合は追加
    if RAKUTEN_AFFILIATE_ID:
        params["affiliateId"] = RAKUTEN_AFFILIATE_ID

    headers = {
        "Referer": "https://chaidol.com/",
        "Origin": "https://chaidol.com",
    }

    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            response = await client.get(RAKUTEN_API_BASE, params=params, headers=headers)
            response.raise_for_status()
            data = response.json()
        except httpx.HTTPError as e:
            raise HTTPException(status_code=502, detail=f"楽天APIエラー: {str(e)}")

    # レスポンスを整形（新APIは {"Item": {...}} 構造）
    items = []
    for entry in data.get("Items", []):
        item = entry.get("Item", entry)
        def extract_urls(field):
            return [
                (img.get("imageUrl") if isinstance(img, dict) else img)
                for img in item.get(field, [])
                if (img.get("imageUrl") if isinstance(img, dict) else img)
            ]

        medium_urls = extract_urls("mediumImageUrls")
        small_urls  = extract_urls("smallImageUrls")

        # ベースURL（クエリなし）で重複排除し、smallをmediumサイズに昇格して最大6枚
        seen = set()
        image_urls = []
        for url in medium_urls:
            base = url.split("?")[0]
            if base not in seen:
                seen.add(base)
                image_urls.append(url)
        for url in small_urls:
            base = url.split("?")[0]
            if base not in seen and len(image_urls) < 6:
                seen.add(base)
                # サイズパラメータをmediumに統一
                image_urls.append(base + "?_ex=128x128")
        items.append({
            "itemCode": item.get("itemCode"),
            "itemName": item.get("itemName"),
            "itemPrice": item.get("itemPrice"),
            "itemUrl": item.get("affiliateUrl") or item.get("itemUrl"),
            "imageUrl": image_urls[0] if image_urls else None,
            "imageUrls": image_urls,
            "shopName": item.get("shopName"),
        })

    return {
        "items": items,
        "count": data.get("count", 0),
        "page": data.get("page", 1),
        "pageCount": data.get("pageCount", 1),
    }


# ─── 画像→base64変換ユーティリティ ────────────────────────

async def image_upload_to_jpeg_bytes(upload: UploadFile) -> bytes:
    """UploadFileをJPEGバイト列に変換"""
    image_bytes = await upload.read()
    if len(image_bytes) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="画像サイズは10MB以下にしてください")
    try:
        img = Image.open(io.BytesIO(image_bytes))
        if img.mode != "RGB":
            img = img.convert("RGB")
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=90)
        return buf.getvalue()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"画像の読み込みに失敗しました: {str(e)}")


async def image_upload_to_base64(upload: UploadFile) -> str:
    image_bytes = await upload.read()
    if len(image_bytes) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="画像サイズは10MB以下にしてください")
    try:
        img = Image.open(io.BytesIO(image_bytes))
        if img.mode != "RGB":
            img = img.convert("RGB")
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=90)
        image_bytes = buf.getvalue()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"画像の読み込みに失敗しました: {str(e)}")
    b64 = base64.b64encode(image_bytes).decode("utf-8")
    return f"data:image/jpeg;base64,{b64}"


async def run_fashn_tryon(model_image_data: str, garment_image_data: str) -> str:
    """FASHN.aiに試着リクエストを投げて結果URLを返す"""
    if not FASHN_API_KEY:
        raise HTTPException(status_code=500, detail="FASHN.ai APIキーが設定されていません")

    headers = {
        "Authorization": f"Bearer {FASHN_API_KEY}",
        "Content-Type": "application/json",
    }
    run_payload = {
        "model_name": "tryon-max",
        "inputs": {
            "model_image": model_image_data,
            "product_image": garment_image_data,
        },
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            run_response = await client.post(f"{FASHN_API_BASE}/run", headers=headers, json=run_payload)
            run_response.raise_for_status()
            run_data = run_response.json()
        except httpx.HTTPStatusError as e:
            detail = e.response.text if e.response else str(e)
            raise HTTPException(status_code=502, detail=f"FASHN.ai 投入エラー: {detail}")

    prediction_id = run_data.get("id")
    if not prediction_id:
        raise HTTPException(status_code=502, detail="FASHN.ai からIDが返りませんでした")

    async with httpx.AsyncClient(timeout=15.0) as client:
        for _ in range(30):
            await asyncio.sleep(2)
            try:
                status_response = await client.get(f"{FASHN_API_BASE}/status/{prediction_id}", headers=headers)
                status_response.raise_for_status()
                status_data = status_response.json()
            except httpx.HTTPError as e:
                raise HTTPException(status_code=502, detail=f"FASHN.ai ステータス確認エラー: {str(e)}")

            status = status_data.get("status")
            if status == "completed":
                output = status_data.get("output", [])
                if output:
                    return output[0]
                raise HTTPException(status_code=502, detail="試着画像の生成に失敗しました")
            if status in ("failed", "cancelled"):
                error_msg = status_data.get("error", "不明なエラー")
                raise HTTPException(status_code=502, detail=f"FASHN.ai 生成失敗: {error_msg}")

    raise HTTPException(status_code=504, detail="試着画像の生成がタイムアウトしました（60秒）")


# ─── Leffa (HuggingFace・無料) ────────────────────────────

LEFFA_SPACE = "https://franciszzj-leffa.hf.space"

async def run_leffa_tryon(person_bytes: bytes, garment_bytes: bytes) -> str:
    """Leffa HuggingFace SpaceをhttpxでPOSTして試着結果を返す"""
    session_hash = uuid.uuid4().hex[:10]

    hf_headers = {"Authorization": f"Bearer {HF_TOKEN}"} if HF_TOKEN else {}

    async with httpx.AsyncClient(timeout=30.0) as client:
        # 人物画像をアップロード
        r = await client.post(
            f"{LEFFA_SPACE}/gradio_api/upload",
            files=[("files", ("person.jpg", person_bytes, "image/jpeg"))],
            headers=hf_headers,
        )
        r.raise_for_status()
        person_path = r.json()[0]

        # 服画像をアップロード
        r = await client.post(
            f"{LEFFA_SPACE}/gradio_api/upload",
            files=[("files", ("garment.jpg", garment_bytes, "image/jpeg"))],
            headers=hf_headers,
        )
        r.raise_for_status()
        garment_path = r.json()[0]

    # キューにジョブ投入
    payload = {
        "data": [
            {"path": person_path, "meta": {"_type": "gradio.FileData"}},
            {"path": garment_path, "meta": {"_type": "gradio.FileData"}},
            False, 30, 2.5, 42, "viton_hd", "upper_body", False,
        ],
        "event_data": None,
        "fn_index": 0,
        "session_hash": session_hash,
    }
    async with httpx.AsyncClient(timeout=15.0) as client:
        r = await client.post(
            f"{LEFFA_SPACE}/gradio_api/queue/join",
            json=payload,
            headers={"Content-Type": "application/json", **hf_headers},
        )
        r.raise_for_status()

    # SSEでポーリング（最大120秒）
    async with httpx.AsyncClient(timeout=130.0) as client:
        async with client.stream(
            "GET",
            f"{LEFFA_SPACE}/gradio_api/queue/data",
            params={"session_hash": session_hash},
            headers={"Accept": "text/event-stream", **hf_headers},
        ) as stream:
            async for line in stream.aiter_lines():
                if not line.startswith("data:"):
                    continue
                event = line[5:].strip()
                if not event:
                    continue
                try:
                    data = __import__("json").loads(event)
                except Exception:
                    continue
                msg = data.get("msg")
                if msg == "process_completed":
                    if not data.get("success"):
                        err = data.get("output", {}).get("error") or data.get("title", "不明なエラー")
                        raise HTTPException(status_code=502, detail=f"Leffa処理失敗: {err}")
                    output_list = data.get("output", {}).get("data", [])
                    if not output_list:
                        raise HTTPException(status_code=502, detail="Leffa: 出力が空でした")
                    output = output_list[0]
                    if isinstance(output, dict):
                        url = output.get("url") or output.get("path")
                        if url:
                            return url
                    if isinstance(output, str) and output.startswith("http"):
                        return output
                    raise HTTPException(status_code=502, detail=f"Leffa: URL取得失敗 output={output}")
                if msg == "process_errored":
                    raise HTTPException(status_code=502, detail=f"Leffa エラー: {data}")

    raise HTTPException(status_code=504, detail="Leffa: タイムアウト（120秒）")


@app.post("/api/try-on-leffa")
async def try_on_leffa(
    person_image: UploadFile = File(...),
    garment_image: UploadFile = File(...),
):
    person_bytes = await image_upload_to_jpeg_bytes(person_image)
    garment_bytes = await image_upload_to_jpeg_bytes(garment_image)
    result_url = await run_leffa_tryon(person_bytes, garment_bytes)
    return {"result_url": result_url}


# ─── FASHN.ai API ──────────────────────────────────────────

@app.post("/api/try-on")
async def try_on(
    person_image: UploadFile = File(...),
    garment_url: str = Query(...),
):
    person_data = await image_upload_to_base64(person_image)
    result_url = await run_fashn_tryon(person_data, garment_url)
    return {"result_url": result_url}


@app.post("/api/try-on-file")
async def try_on_file(
    person_image: UploadFile = File(...),
    garment_image: UploadFile = File(...),
):
    person_data  = await image_upload_to_base64(person_image)
    garment_data = await image_upload_to_base64(garment_image)
    result_url = await run_fashn_tryon(person_data, garment_data)
    return {"result_url": result_url}


# ─── ヘルスチェック ────────────────────────────────────────

@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "fashn_configured": bool(FASHN_API_KEY),
        "rakuten_configured": bool(RAKUTEN_APP_ID),
    }


if __name__ == "__main__":
    import uvicorn
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host=host, port=port, reload=True)
