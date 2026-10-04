import asyncio,json,os
from playwright.async_api import async_playwright
async def main():
  m=json.load(open(os.path.expanduser("~/.cache/lovable-auth/session.json")))
  async with async_playwright() as p:
    b=await p.chromium.launch(headless=True);c=await b.new_context(viewport={"width":1280,"height":1800});pg=await c.new_page()
    errs=[];pg.on("pageerror",lambda e:errs.append(str(e)))
    await pg.goto("http://localhost:8080");await pg.evaluate(f"localStorage.setItem({json.dumps(m['storage_key'])},{json.dumps(json.dumps(m['session']))})")
    await pg.goto("http://localhost:8080/admin");await pg.wait_for_timeout(5000)
    await pg.get_by_role("button",name="Capítulos").first.click();await pg.wait_for_timeout(4000)
    print(pg.url)
    await pg.get_by_role("button",name="Editar").first.click();await pg.wait_for_timeout(3000);await pg.screenshot(path="ch.png")
    print(errs)
    await b.close()
asyncio.run(main())
