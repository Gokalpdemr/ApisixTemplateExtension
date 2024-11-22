const fs = require("fs");
const path = require("path");
const vscode = require("vscode");

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
	const disposable = vscode.commands.registerCommand(
		"apisixtemplategenerator.createApisix",
		function () {
			createProjectStructure();
		}
	);

	context.subscriptions.push(disposable);
}

function deactivate() { }

module.exports = {
	activate,
	deactivate,
};

async function generateRouteJson(
	projectName,
	routeName,
	environment,
	isConsumer,
	isCluster,
	hostname,
	routeCount,
	isIntprod,
	isDapr
) {
	let uri;

	if (isDapr) {
		uri = `/${environment === "intprod" ? `${projectName}` : `test-${projectName}`}/${routeName}/*`;
	} else {
		uri = `/${routeCount === 1
			? `${environment === "intprod" ? `${projectName}` : `test-${projectName}`}` 
			: `${environment === "intprod" ? `${routeName}` : `test-${routeName}`}`}/api/*`;
	}
	const route = {
		uri: uri,

		name: isDapr?`${environment === "intprod" ?`intprod-${projectName}-${routeName}`:`test-${projectName}-${routeName}`}` :`${routeCount===1 ? `${environment === "intprod" ? "" : "test-"}${projectName}`:`${environment === "intprod" ? "" : "test-"}${routeName}`}`,
		methods: ["POST", "GET", "OPTIONS"],
		plugins: {
			...(isIntprod && {
				"ip-restriction": {
					disable: false,
					message: "Your IP address is not allowed",
					whitelist: [
						"10.180.140.20",
						"10.180.140.21",
						"10.180.140.22",
						"10.180.140.23",
						"10.180.140.24",
						"10.180.140.25",
						"10.180.140.26",
						"10.180.140.27",
						"10.180.140.28",
						"10.180.140.29",
						"10.180.140.30",
						"10.180.140.31",
						"10.180.140.32",
						"10.180.140.33",
						"10.180.140.34",
						"10.180.140.35",
						"10.180.140.36",
						"10.180.140.37",
						"10.180.140.38",
						"10.180.140.39",
						"10.180.140.40",
						"10.180.140.41",
						"10.180.140.42",
						"10.180.140.43",
						"10.180.140.44",
						"10.180.140.45",
						"10.180.140.46",
						"10.180.140.47",
						"10.180.140.48",
						"10.180.140.49",
						"10.180.140.50",
						"10.180.140.51",
						"10.180.140.52",
						"10.180.140.53",
						"10.180.140.54",
						"10.180.140.55",
						"10.180.140.56",
						"10.180.140.57",
						"10.180.140.58",
						"10.180.140.59",
						"10.180.140.60",
						"10.180.140.61",
						"10.180.140.62",
						"10.180.140.63",
						"10.180.140.64",
						"10.180.140.65",
						"10.180.140.66",
						"10.180.140.67",
						"10.180.140.68",
						"10.180.140.69",
						"10.180.140.70",
						"10.180.140.71",
						"10.180.140.72",
						"10.180.140.73",
						"10.180.140.74",
						"10.180.140.75",
						"10.180.140.76",
						"10.180.140.77",
						"10.180.140.78",
						"10.180.140.79",
						"10.180.140.80",
					],
				},
				"real-ip": {
					disable: false,
					recursive: false,
					source: "http_x_forwarded_for",
				},
			}),
			...(isConsumer && {
				"consumer-restriction": {
					disable: false,
					rejected_code: 403,
					type: "consumer_name",
					whitelist: [projectName],
				},
			}),
			"proxy-rewrite": {
				regex_uri: isDapr
				// Dapr varsa özel düzenleme
				? [`^/${environment === "intprod" ? `${projectName}` : `test-${projectName}`}/${routeName}/*`, `/v1.0/invoke/${routeName}.test-${projectName}/method/$1`]
				// Dapr yoksa eski düzenleme
				: [`^/${routeCount === 1 
					? `${environment === "intprod" ? `${projectName}` : `test-${projectName}`}` 
					: `${environment === "intprod" ? `${routeName}` : `test-${routeName}`}`}/api/(.*)`, "/api/$1"],
		},
		},
		upstream_id: "UPSTREAMID",
		status: 1,
	};

	return route;
}
async function generateUpstreamJson(
	projectName,
	routeName,
	environment,
	isCluster,
	hostname,
	routeCount,
	isIntprod,
	isDapr

) {
	routeName=routeCount==1?projectName:routeName
	const upstreamJson = {
		nodes: [
			{
				host: isDapr ?
				      "localhost" 
					  :isCluster
					? `${routeName}-host.${environment === "intprod" ? "intprod" : "test"
					}-${routeName}.svc.cluster.local`
					: hostname
						? `${hostname}`
						: `${routeName}-host.${environment === "intprod" ? "intprod" : "test"
						}-${routeName}.svc.cluster.local`,

				port: isDapr ? 3500 : isCluster ? 5000 : 443,

				weight: 1,
			},
		],

		timeout: {
			connect: 60,

			send: 45,

			read: 45,
		},

		type: "roundrobin",

		hash_on: "vars",

		scheme:isDapr || isCluster ? "http" : "https",

		pass_host: "node",

		name:isDapr ? "apisix-dapr"
		    : isCluster
			? isIntprod
				? `intprod-${routeName}`
				: `test-${routeName}`
			: `${hostname}`,

		desc: isDapr? "apisix-dapr" :isCluster
			? `${routeName} den verilen servislerin upstream tanimi`
			: `${hostname}`,

		keepalive_pool: {
			idle_timeout: 60,

			requests: 1000,

			size: 620,
		},
	};

	return upstreamJson;
}

async function generateConsumerJson(projectName) {
	const consumerJson = {
		username: projectName,

		plugins: {
			"key-auth": {
				disable: false,

				header: "Authorization",

				key: `${projectName}-consumer-key`,
			},
		},
	};

	return consumerJson;
}

async function createProjectStructure() {
	const projectName = await vscode.window.showInputBox({
		placeHolder: "Proje adını giriniz (myProject)",
	});

	if (!projectName) {
		vscode.window.showErrorMessage("Proje adı girilmeli");

		return;
	}

	const deploymentType = await vscode.window.showQuickPick(
		["Cluster", "Ingress", "Dapr"],
		{
			placeHolder: "Cluster'ı mı yoksa Ingress'i mi kullanacaksınız?",
		}
	);

	if (!deploymentType) {
		vscode.window.showErrorMessage("Dağıtım türü seçilmelidir");

		return;
	}

	const isCluster = deploymentType === "Cluster";
	const isDapr = deploymentType === "Dapr";

	const isConsumer =
		(await vscode.window.showQuickPick(["Evet", "Hayır"], {
			placeHolder: "Consumer.json dosyası oluşturulmalı mı?",
		})) === "Evet";

	let hostname;

	if (!isCluster&&!isDapr) {
		hostname = await vscode.window.showInputBox({
			placeHolder: "Host ismini giriniz.",
		});
	}


	let routeNames = [];
	if (isDapr) {
		const routeNamesInput = await vscode.window.showInputBox({
			placeHolder: "Route isimlerini giriniz (virgül ile ayırarak)",
		});

		if (!routeNamesInput) {
			vscode.window.showErrorMessage("Route adları girilmelidir");
			return;
		}

		routeNames = routeNamesInput.split(",").map((name) => name.trim());
	} else {
		const hasSubRoutes =
			(await vscode.window.showQuickPick(["Evet", "Hayır"], {
				placeHolder: "Birden fazla route var mı ?",
			})) === "Evet";

		if (hasSubRoutes) {
			const routeNamesInput = await vscode.window.showInputBox({
				placeHolder: "Route isimlerini giriniz (virgül ile ayırarak)",
			});

			if (!routeNamesInput) {
				vscode.window.showErrorMessage("Route adları girilmelidir");
				return;
			}

			routeNames = routeNamesInput.split(",").map((name) => name.trim());
		} else {
			routeNames = ["route-1"];
		}
	}

	const projectFolder = path.join(vscode.workspace.rootPath || "", projectName);

	if (!fs.existsSync(projectFolder)) {
		fs.mkdirSync(projectFolder);
	}

	for (const routeName of routeNames) {
		const intprodFolder = path.join(projectFolder, "intprod", routeName);

		const nonprodFolder = path.join(projectFolder, "nonprod", routeName);

		if (!fs.existsSync(path.join(projectFolder, "intprod"))) {
			fs.mkdirSync(path.join(projectFolder, "intprod"));
		}

		if (!fs.existsSync(path.join(projectFolder, "nonprod"))) {
			fs.mkdirSync(path.join(projectFolder, "nonprod"));
		}

		if (!fs.existsSync(intprodFolder)) {
			fs.mkdirSync(intprodFolder);
		}

		if (!fs.existsSync(nonprodFolder)) {
			fs.mkdirSync(nonprodFolder);
		}

		const routeJsonIntprodPath = path.join(intprodFolder, "route.json");
		const upstreamJsonIntprodPath = path.join(intprodFolder, "upstream.json");
		const consumerJsonIntprodPath = path.join(intprodFolder, "consumer.json");

		const routeJsonNonprodPath = path.join(nonprodFolder, "route.json");
		const upstreamJsonNonprodPath = path.join(nonprodFolder, "upstream.json");
		const consumerJsonNonprodPath = path.join(nonprodFolder, "consumer.json");

		// Route JSON'ları için generate işlemi
		const routeJsonIntprod = await generateRouteJson(
			projectName,
			routeName,
			"intprod",
			isConsumer,
			isCluster,
			hostname,
			routeNames.length,
			true,
			isDapr
		);

		const upstreamJsonIntprod = await generateUpstreamJson(
			projectName,
			routeName,
			"intprod",
			isCluster,
			hostname,
			routeNames.length,
			true,
			isDapr

		);

		const consumerJsonIntprod = isConsumer
			? await generateConsumerJson(projectName)
			: null;

		const routeJsonNonprod = await generateRouteJson(
			projectName,
			routeName,
			"nonprod",
			isConsumer,
			isCluster,
			hostname,
			routeNames.length,
			false,
			isDapr
		);

		const upstreamJsonNonprod = await generateUpstreamJson(
			projectName,
			routeName,
			"nonprod",
			isCluster,
			hostname,
			routeNames.length,
			false,
			isDapr

		);

		const consumerJsonNonprod = isConsumer
			? await generateConsumerJson(projectName)
			: null;

		fs.writeFileSync(
			routeJsonIntprodPath,
			JSON.stringify(routeJsonIntprod, null, 2)
		);

		fs.writeFileSync(
			upstreamJsonIntprodPath,
			JSON.stringify(upstreamJsonIntprod, null, 2)
		);

		if (consumerJsonIntprod) {
			fs.writeFileSync(
				consumerJsonIntprodPath,
				JSON.stringify(consumerJsonIntprod, null, 2)
			);
		}

		fs.writeFileSync(
			routeJsonNonprodPath,
			JSON.stringify(routeJsonNonprod, null, 2)
		);

		fs.writeFileSync(
			upstreamJsonNonprodPath,
			JSON.stringify(upstreamJsonNonprod, null, 2)
		);

		if (consumerJsonNonprod) {
			fs.writeFileSync(
				consumerJsonNonprodPath,
				JSON.stringify(consumerJsonNonprod, null, 2)
			);
		}
	}

	vscode.window.showInformationMessage("Proje yapısı başarıyla oluşturuldu.");
}


