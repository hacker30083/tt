const PATH = "/src/";

const Pos = {
	FIRST: "first",
	MID: false,
	LAST: "last"
};

function sURL(s) {
	return PATH + s;
}

let
op = [],	// õpetajad
pkt = [],	// praktikumid
tt = [],
ttc = null,
th,
code,
gr = {};	// grupid

const

pages = Array.from(document.getElementsByClassName("page")),

allCookies = () => { return document.cookie.split(";"); },

setCookie = (k, v) => {
	// expire after 3 months
	document.cookie = String(k) + "=" + String(v) + `; path=${PATH}; SameSite=Strict; Secure; expires=` + (new Date(Date.now()+7776000000)).toUTCString();
},

getCookie = (k) => {
	k += "=";
	const a = allCookies();
	const l = a.length;
	for (let i=0; i<l; i++) {
		let c = a[i];
		while (c.charAt(0) == " ") {
			c = c.substring(1);
		}
		if (c.indexOf(k) == 0) {
			return c.substring(k.length, c.length);
		}
	}
	return null;
},

clearAll = () => {
	const
	a = allCookies(),
	l = a.length,
	zd = (new Date(0)).toUTCString();

	for (let i=0; i<l; i++) {
		document.cookie = a[i] + `=;expires=${zd}`;
	}
}

getData = async (url) => {
	try {
		const response = await fetch(url);
		if (!response.ok) {
			throw new Error(`Võrgu vastuse viga: ${response.status}`);
		}

		const result = await response.text();
		return result;
	} catch (err) {
		console.error(err.message);
	}
},

getURLParams = (url) => {
	let obj = {};

	(url.match(/([^?=&]+)(=([^&]*))/g)??[]).forEach(k => {
		const s = k.split("=");

		obj[s[0]] = s[1];
	});
	
	return obj;
},

sTheme = (a = 0) => {
	th = Math.round(a%3);

	const s =
		th==0 ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? 1 : 2)
		: th;
	
	//document.getElementById("theme").innerText = ["vaikimisi", "tume", "hele"][th];

	const d = document.documentElement.style;

	[
		["--bg-brightness", 0.5, 2],
		["--bg", "#000", "#fff"],
		["--bg-m", "#222", "#eee"],
		["--gray", "#666", "#999"],
		["--lighter-gray", "#888", "#666"],
		["--ltrans", "#cccc", "#444c"],
		["--light-fg", "#ccc", "#555"],
		["--fg-m", "#ddd", "#555"],
		["--fg", "#fff", "#000"],
		["--darksky", "#445", "#dde"],
		["--purple", "#86f", "#86f"],
		["--purple-fg", "#cbf", "#435"],
	].forEach(k => {
		d.setProperty(k[0], k[s]);
	});

	setCookie("t", th);
},

load = (h) => {
	if (h === null) {
		return;
	}

	try {
		gr = {
			m: parseInt(h[0]),
			e: parseInt(h[1]),
			bvk: parseInt(h[2]),
			ik: parseInt(h[3]),
			t: parseInt(h[4]),
			s: parseInt(h[5]),
			pkt: parseInt(h[6], 36)
		};

		if (gr.e < 1 || gr.e > 6) { throw new Error("Vale eesti keele kood."); }
		if (gr.e < 1 || gr.e > 6) { throw new Error("Vale matemaatika kood."); }
		if (gr.bvk > 6) { throw new Error("Vale b-võõrkeele kood."); }
		if (gr.ik > 5) { throw new Error("Vale inglise keele kood."); }
		if (gr.t > 5) { throw new Error("Vale tiimi kood."); }
		if (gr.s > 4) { throw new Error("Vale suure grupi kood."); }
		if (gr.pkt > 16) { throw new Error("Vale praktikumi kood."); }
	} catch (e) {
		console.warn(`Viga salvestatud grupikombinatsiooni laadimisel (${e}). Salvestatud kood oli "${h}"`);
		return;
	}

	genTT();
	save();
},

save = () => {
	code = `${gr.m}${gr.e}${gr.bvk}${gr.ik}${gr.t}${gr.s}${(gr.pkt).toString(36)}`;
	setCookie("g", code);
},

share = () => {
	navigator.clipboard.writeText(`mk4i.github.com/tt/src/index.html?g=${code}`);
},

page = (n) => {
	pages.forEach(k => {
		k.style.display = (n===k.id)
			? ""
			: "none";
	});
},

gg = (sub) => {
	switch (sub) {
		case "ik":	return gr.ik;
		case "e":	return gr.e;
		case "m":	return gr.m;
		case "fys":	return gr.m;
		case "kem":	return gr.m;
		case "bvk":	return gr.bvk;
		case "lg":	return gr.t;
		case "t":	return gr.t;
		case "pkt": return gr.pkt;
		case "li":	return gr.m;
		default:	return gr.s;
	}
},

go = (id) => {
	const t = op.find((k) => {
		return (k.l == id);
	});

	if (t === undefined) {
		console.warn(`Ei leitud sobivat õpetajat loetelust. Id: ${id}`);
		return null;
	}

	return t.n;
},

gt = (sub) => {
	switch (sub) {
		case "aj":	return "Ajalugu";
		case "bio":	return "Bioloogia";
		case "bvk":	return ["Saksa", "Prantsuse", "Vene"][[0, 2, 2, 2, 2, 1, 1][gr.bvk]];
		case "e":	return "Eesti";
		case "fys":	return "Füüsika";
		case "ik":	return "Inglise";
		case "kir":	return "Kirjandus";
		case "geo":	return "Geograafia";
		case "kem":	return "Keemia";
		case "kst":	return "Kunst";
		case "lg":	return "Luge";
		case "li":	return "Keka";
		case "m":	return "Mate";
		case "pkt":	return "Praktikum";
		case "t":	return "Tiimit";
		case "yh":	return "Ühiskonnaõp";
	}
},

pushItem = (
	x, y, title = "-", start_time = undefined, end_time = undefined,
	location = false, name = false, isBreak = false, pos = false, w = 1
) => {
	const t_str = start_time ? (end_time ? start_time + " - " + end_time : start_time) : (end_time??"-");
	const obj = { x: x, y: y, title: title, time: t_str };
	if (w > 1) {
		obj.w = w;
	}
	if (location !== false) {
		obj.location = location;
	}
	if (name !== false) {
		obj.name = name;
	}
	if (isBreak === true) {
		obj.isBreak = true;
	}
	if (pos !== false) {
		obj.position = pos;
	}
	
	tt.push(obj);
},

// t = target
// c = current
getScale = (t, c) => {
	return (t < c)
		? t/c
		: 1;
},

shortName = (str) => {
	let r = [];
	str.split("/").forEach(k => {
		const nl = k.trim().split(" ");
		r.push(nl[0].split("-")[0] + " " + nl.at(-1).split("-")[0][0]);
	});

	return r.join(", ");
},

graphTT = () => {
	const e = document.getElementById("tt");

	e.innerHTML = `<div class="num" style="grid-column: 2 / span 2;">1</div>
<div class="num s" style="grid-column: 4;">Amps</div>
<div class="num" style="grid-column: 5 / span 2;">2</div>
<div class="num s" style="grid-column: 7;">Proaeg</div>
<div class="num" style="grid-column: 8 / span 2;">3</div>
<div class="num" style="grid-column: 10 / span 2;">4</div>
<div class="wkd" style="grid-row: 2;">E</div>
<div class="wkd" style="grid-row: 3;">T</div>
<div class="wkd" style="grid-row: 4;">K</div>
<div class="wkd" style="grid-row: 5;">N</div>
<div class="wkd" style="grid-row: 6;">R</div>`;

	const len = tt.length;
	for (let i = 0; i < len; i++) {
		const k = tt[i];

		const div = document.createElement("div");
		div.classList.add("item", k.isBreak?"break":"lesson");

		if (k.position !== undefined) {
			div.classList.add(k.position);
		}

		div.style.gridArea = `${k.y+2} / ${k.x+2}${k.w>1?" / span 1 / span "+k.w:""}`;

		const label = document.createElement("label");
		label.innerText = k.title;

		const time = document.createElement("time");
		time.innerText = k.time;

		div.appendChild(label);
		div.appendChild(time);

		e.appendChild(div);

		const
		wl = div.getBoundingClientRect().width,
		scl = getScale(0.96*wl, label.getBoundingClientRect().width);

		if (scl < 1) {
			label.style.scale = scl;
		}

		const nk = (k.name !== undefined) + (k.location !== undefined);

		if (nk == 2) {
			const br = document.createElement("p");
			br.innerText = k.name;
			br.classList.add("bottom", "right");
			div.appendChild(br);

			if (br.getBoundingClientRect().width > 0.48*wl) {
				br.innerText = shortName(k.name);
			}

			const bl = document.createElement("p");
			bl.innerText = k.location;
			bl.classList.add("bottom", "left");
			div.appendChild(bl);

			if (
				br.getBoundingClientRect().width <= 0.48*wl &&
				bl.getBoundingClientRect().width <= 0.48*wl
			) {
				continue;
			}

			div.removeChild(bl);
			div.removeChild(br);
		}
	
		const bc = document.createElement("p");
		bc.innerText = nk==0 ? "-" : ((k.location??"") + (k.w>1 ? "   " : "  ") + (k.name??"")).trim();
		bc.classList.add("bottom", "center");
		div.appendChild(bc);

		if (bc.getBoundingClientRect().width > 0.96*wl && k.name !== undefined) {
			bc.innerText = (!k.location ? "" : k.location + (k.w>1 ? "   " : "  ")) + shortName(k.name);
		}

		const bcs = getScale(0.96*wl, bc.getBoundingClientRect().width);

		if (bcs < 1) {
			bc.style.scale = bcs;
		}
	}
},

waitForInput = async (acceptionList, rejection) => {
	return new Promise((resolve, reject) => {

		const accept = function() {
			const r = parseInt(this.value);
			resolve(isNaN(r) ? this.value : r);
		};

		const abort = function() {
			this.removeEventListener("click", abort);
			reject(new Error("Aborted"));
		}

		acceptionList.forEach(k => {
			k.addEventListener("click", accept);
		});

		rejection.addEventListener("click", abort);
	});
},

setupPage = (pre, options) => {
	document.getElementById("pre").innerHTML = pre;

	const opt = document.getElementById("opt");
	let acceptionList = [];

	opt.innerHTML = "";

	options.forEach(k => {
		const
		b = document.createElement("button");
		b.value = k.value;
		b.innerHTML = k.title;
		opt.appendChild(b);

		acceptionList.push(b);
	});

	return(waitForInput(acceptionList, document.getElementById("abort")));
}

genTT = () => {
	tt = [];

	ttc.split("\n").forEach(k => {
		if (k !== "" && k[0] !== "#") {

			const
			s = k.split("|"),
			coord = s[0].split(" "),
			y = Number(coord[0]),
			x = Number(coord[1]),
			w = Number(coord[2]),
			pos = coord[3]==="f" ? Pos.FIRST : (coord[3]==="l" ? Pos.LAST : Pos.MID),
			startTime = s[1].trim(),
			endTime = s[2].trim(),
			gi = s[3].trim().split("/"),
			gil = gi.length;

			let
			title = undefined,
			location = false,
			name = false,
			isBreak = false;

			for (let i = 0; i < gil; i++) {
				const
				dat = gi[i].trim().split(" "),
				id = dat[0],
				loc = dat[1],
				gnum = id.match(/\d/),
				sub = id.replace(/\d/, ""),
				ag = gg(sub);

				if (ag == gnum || gnum === null) {
					title = gt(sub);
					name = go(sub + ag);
					location = loc;
					break;
				}
			}

			if (title !== undefined) {
				pushItem(
					x, y,
					title,
					startTime, endTime,
					location, name, isBreak,
					pos, w
				);
			}

		}
	});

	const p = pkt[gr.pkt];

	pushItem(8, 1, "Praktikum", p.stime, p.etime, p.loc, p.n, false, Pos.LAST, 2);

	for (let i = 0; i < 5; i++) {
		pushItem(2, i, "Amps", "10:20", "10:40", "-", false, true);
	}

	for (let i = 2; i < 5; i++) {
		pushItem(5, i, "Pro", "12:00", "12:40", "-", false, true);
	}

	for (let i = 0; i < 5; i+=2) {
		pushItem(8, i, "Lõuna", "14:00", "14:20", "-", false, true);
	}

	pushItem(7, 1, "Lõuna", "13:25", "13:45", "-", false, true);

	if (gr.m == 2 || gr.m == 6) {
		pushItem(6, 3, "Lõuna", "12:40", "13:00", "-", false, true);
	} else {
		pushItem(8, 3, "Lõuna", "14:00", "14:20", "-", false, true, Pos.LAST);
	}

	graphTT();
}

main = async () => {
	await getData(sURL("op.txt")).then(data => {
		data.split("\n").forEach(k => {

			const
			l = k.split("|"),
			n = l[0].trim();

			l[1].trim().split("\t").forEach(s => {
				op.push({
					l: s.trim(),
					n: n
				});
			});

		});
	});

	await getData(sURL("pkt.txt")).then(data => {
		data.split("\n").forEach(k => {

			const l = k.split("|").map(m => {
				const v = m.trim();
				return v=="" ? undefined : v;
			});

			pkt.push({
				t: l[0],
				stime: l[1],
				etime: l[2],
				loc: l[3],
				n: l[4]
			});

		});
	});

	ttc = await getData(sURL("tt.txt"));

	const param = getURLParams(window.location.href);

	if (param.g !== undefined) {
		load(param.g);
	} else {
		load(getCookie("g"));
		document.getElementById("share-warning").style.display = "none";
	}

	sTheme(getCookie("t")??0);

	page("home");

	document.getElementById("l").style.display = "none";
}

setup = async () => {
	// show page
	page("setup");

	let gn = {};

	try {
		let options = [];
		for (let i = 1; i < 7; i++) {
			options.push({title: `<strong>9.${i}</strong> (${go(`m${i}`)})`, value: i});
		}
		gn.m = await setupPage("<h1>Matemaatika grupp</h1><p>Millises matemaatika grupis Sa oled?</p>", options);

		options = [];
		for (let i = 1; i < 7; i++) {
			options.push({title: `<strong>9.${i}</strong> (${go(`e${i}`)})`, value: i});
		}
		gn.e = await setupPage("<h1>Eesti keel</h1><p>Millises eesti keele grupis Sa oled?</p>", options);

		options = [];
		for (let i = 0; i < 7; i++) {
			options.push({title: `<strong>${
				["saksa keel", "vene keel 1", "vene keel 2", "vene keel 3", "vene keel 4", "prantsuse keel 1", "prantsuse keel 2"][i]
			}</strong> (${go(`bvk${i}`)})`, value: i});
		}
		gn.bvk = await setupPage("<h1>B-võõrkeel</h1><p>Millises B-võõrkeele grupis Sa oled?</p>", options);

		options = [];
		for (let i = 0; i < 6; i++) {
			options.push({title: `<strong>${["I", "II", "III"][i%3]} ${i<3?"A":"B"}</strong> (${go(`ik${i}`)})`, value: i});
		}
		gn.ik = await setupPage("<h1>Inglise keele grupp</h1><p>Millises inglise keele grupis Sa oled?</p>", options);

		let fault = [];
		if ((gn.m<4 && gn.e>3) || (gn.m>3 && gn.e<4)) {
			fault.push(`Matemaatika grupp <strong>9.${gn.m}</strong> ja eesti keele grupp <strong>9.${gn.e}</strong>`);
		}
		const ib = gn.bvk==0 || gn.bvk==3 || gn.bvk==4;
		if (ib ? (gn.ik<3) : (gn.ik>2)) {
			fault.push(`Inglise keele grupp <strong>${["I", "II", "III"][gn.ik%3]} ${gn.ik<3?"A":"B"}</strong> ja b-võõrkeele grupp <strong>${["saksa keel", "vene keel 1", "vene keel 2", "vene keel 3", "vene keel 4", "prantsuse keel 1", "prantsuse keel 2"][gn.bvk]}</strong>`);
		}
		const fl = fault.length;

		if (fl>0) {
			await setupPage(`<h1>Gruppide viga</h1><h2>Järgnev${fl>1?"ad":""} grupikombinatsioon${fl>1?"id":""} on võimatu${fl>1?"d":""}.</h2><p>${fault.join("<br>")}<br><br>${fl>1?"Need":"See"} eelda${fl>1?"vad":"b"}, et Sul on võimalik olla mitmes kohas korraga, mis pole praktiliselt võimalik. Soovitatav on katkestada ja alustada otsast peale, kuid soovi korral saad ikkagi valitud grupikombinatsiooniga (vigase) tunniplaani genereerida, vajutades <strong>Jätka</strong>.</p>`, [{title: "Jätka", value: 0}]);
		}

		options = [];
		for (let i = 0; i < 6; i++) {
			options.push({title: `<strong>9${"aejkps"[i]}</strong> (${go(`t${i}`)})`, value: i});
		}
		gn.t = await setupPage("<h1>Tiim</h1><p>Millise tiimi liige Sa oled?</p>", options);

		options = [];
		for (let i = 0; i < 5; i++) {
			options.push({title: ["alfa","beeta","gamma","delta","epsilon"][i], value: i});
		}
		gn.s = await setupPage("<h1>Suur grupp</h1><p>Millises suures grupis Sa oled?</p>", options);

		options = [];
		for (let i = 0; i < pkt.length; i++) {
			options.push({title: pkt[i].t, value: i});
		}
		gn.pkt = await setupPage("<h1>Praktikum</h1><p>Millises praktikumis Sa käid?</p>", options);

		gr = gn;

		genTT();
	} catch (e) {
		
	}

	// hide page
	//save();
}

//main();

sTheme(0);