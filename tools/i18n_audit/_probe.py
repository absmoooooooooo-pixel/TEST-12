import sys, pathlib, json
sys.path.insert(0, str(pathlib.Path(__file__).parent))
import round3_fast as r
r.PAGES = ["frontend/calculators/plate/index.html"]
r.main()
data = json.loads(pathlib.Path(__file__).with_name("round3_results.json").read_text(encoding="utf-8"))
fails = [(x["page"], [c for c in x["checks"] if not c["pass"]]) for x in data]
pathlib.Path(__file__).with_name("_probe_out.txt").write_text(json.dumps(fails, ensure_ascii=False, indent=2), encoding="utf-8")
