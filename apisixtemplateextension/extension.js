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
	isIntprod
) {
	const route = {
		uri: `/${environment === "intprod" ? "" : "test-"}${routeName}/api/*`,
		name: `${environment === "intprod" ? "" : "test-"}${routeName}`,
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
				regex_uri: [`^/${routeName}/api/(.*)`, "/api/$1"],
			},
		},
		upstream_id: "UPSTREAMID",
		status: 1,
	};

	if (isCluster) {
		route.plugins["proxy-rewrite"].regex_uri[0] = `^/${routeName}/api/(.*)`;
	} else if (hostname) {
		route.plugins["proxy-rewrite"].regex_uri[0] = `^/${routeName}/api/(.*)`;
	}

	return route;
}
async function generateUpstreamJson(
	projectName,
	routeName,
	environment,
	isCluster,
	hostname,
	isIntprod
) {
	const upstreamJson = {
		nodes: [
			{
				host: isCluster
					? `${routeName}-host.${environment === "intprod" ? "intprod" : "test"
					}-${routeName}.svc.cluster.local`
					: hostname
						? `${hostname}`
						: `${routeName}-host.${environment === "intprod" ? "intprod" : "test"
						}-${routeName}.svc.cluster.local`,

				port: isCluster ? 5000 : 443,

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

		scheme: isCluster ? "http" : "https",

		pass_host: "node",

		name: isCluster
			? isIntprod
				? `intprod-${routeName}`
				: `test-${routeName}`
			: `${hostname}`,

		desc: isCluster
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
		placeHolder: "Enter project name (myProject)",
	});

	if (!projectName) {
		vscode.window.showErrorMessage("Project name must be provided.");

		return;
	}

	const deploymentType = await vscode.window.showQuickPick(
		["Cluster", "Ingress"],
		{
			placeHolder: "Will you use Cluster or Ingress?",
		}
	);

	if (!deploymentType) {
		vscode.window.showErrorMessage("Deployment type must be selected.");

		return;
	}

	const isCluster = deploymentType === "Cluster";

	const isConsumer =
		(await vscode.window.showQuickPick(["Yes", "No"], {
			placeHolder: "Should a consumer.json file be created?",
		})) === "Yes";

	let hostname;

	if (!isCluster) {
		hostname = await vscode.window.showInputBox({
			placeHolder: "Enter hostname",
		});
	}

	const routeNamesInput = await vscode.window.showInputBox({
		placeHolder: "Enter route names (comma-separated)",
	});

	if (!routeNamesInput) {
		vscode.window.showErrorMessage("Route names must be provided.");

		return;
	}

	const routeNames = routeNamesInput.split(",").map((name) => name.trim());

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

		const routeJsonIntprod = await generateRouteJson(
			projectName,
			routeName,
			"intprod",
			isConsumer,
			isCluster,
			hostname,
			true
		);

		const upstreamJsonIntprod = await generateUpstreamJson(
			projectName,
			routeName,
			"intprod",
			isCluster,
			hostname,
			true
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
			false
		);

		const upstreamJsonNonprod = await generateUpstreamJson(
			projectName,
			routeName,
			"nonprod",
			isCluster,
			hostname,
			false
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

	vscode.window.showInformationMessage(
		"Project structure created successfully."
	);
}
