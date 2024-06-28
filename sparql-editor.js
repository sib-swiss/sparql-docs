// Inspired from https://sparql.uniprot.org/sparql.js
// Note that we add `&ac=1` to all the queries to exclude these queries from stats


/** Class to create a SPARQL editor using YASGUI
 * with autocompletion for classes and properties based on VoID description stored in the endpoint
 * and prefixes defined using SHACL in the endpoint
 */
export class SparqlEditor {

	/**
	 * Create a SPARQL editor for a given endpoint
	 * @param {string} endpointUrl - URL of the SPARQL endpoint
	 * @param {HTMLElement} editorEl - Element where the SPARQL editor will be created
	 * @param {HTMLElement} exampleQueriesEl - Element where the SPARQL query examples will be displayed
	 * @param {number} examplesOnMainPage - Number of examples to display on the main page
	 */
	constructor(endpointUrl, editorEl, exampleQueriesEl = null, examplesOnMainPage = 13) {
		this.endpointUrl = endpointUrl;
		this.examplesOnMainPage = examplesOnMainPage;
		Yasqe.forkAutocompleter("class", this.voidClassCompleter);
		Yasqe.forkAutocompleter("property", this.voidPropertyCompleter);
		// Remove the original autocompleters for class and property
		Yasqe.defaults.autocompleters = Yasqe.defaults.autocompleters.filter(item => !["class", "property"].includes(item))
		Yasgui.defaults.requestConfig = {
			endpoint: this.endpointUrl,
			method: "GET",
		}
		// console.log(Yasgui)

		// Create button to add prefixes to the query
		const btnDivEl = document.createElement("div");
		const addPrefBtnEl = document.createElement("button");
		addPrefBtnEl.style.marginBottom = "0.3em";
		addPrefBtnEl.textContent = "Add common prefixes";
		btnDivEl.appendChild(addPrefBtnEl);
		editorEl.appendChild(btnDivEl);

		// Create SPARQL editor and results using YASGUI
		this.yasgui = new Yasgui(editorEl, {
				showQueryButton: true,
				copyEndpointOnNewTab: true,
				resizeable: true,
		});
		console.log(this.yasgui)

		this.yasgui.getTab().yasqe.on("query", (y) => {
			// Results will also use additional prefixes defined in the query
			this.yasgui.getTab().yasr.config.prefixes = {...this.yasgui.getTab().yasr.config.prefixes, ...y.getPrefixesFromQuery()};

			// TODO: add auto limit if not provided, and if it is a SELECT or CONSTRUCT query
			// But the on query event is fired after the query is sent. So it is completely useless as it is...
			// We just need to move yasqe.emit("query") up a few lines here: https://github.com/zazuko/Yasgui/blob/main/packages/yasqe/src/sparql.ts#L73
			// y.setValue(this.ensureLimit(y.getValue()))
		});

		// this.yasgui.getTab().yasqe.on("change", (y) => {
		// 	console.log(this.yasgui.getTab());
		// 	console.log(y, y.getValue())
		// 	y.setValue(this.ensureLimit(y.getValue()))
		// });

		// Get prefixes from endpoint
		this.prefixes = new Map([
			['rdf', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#'],
			['rdfs', 'http://www.w3.org/2000/01/rdf-schema#'],
			['xsd', 'http://www.w3.org/2001/XMLSchema#'],
			['owl', 'http://www.w3.org/2002/07/owl#'],
			['skos', 'http://www.w3.org/2004/02/skos/core#'],
			['up', 'http://purl.uniprot.org/core/'],
			['keywords', 'http://purl.uniprot.org/keywords/'],
			['uniprotkb', 'http://purl.uniprot.org/uniprot/'],
			['taxon', 'http://purl.uniprot.org/taxonomy/'],
			['ec', 'http://purl.uniprot.org/enzyme/'],
			['bibo', 'http://purl.org/ontology/bibo/'],
			['dc', 'http://purl.org/dc/terms/'],
			['faldo', 'http://biohackathon.org/resource/faldo#'],
		]);
		fetch(`${this.endpointUrl}?format=json&ac=1&query=PREFIX sh: <http://www.w3.org/ns/shacl%23> SELECT ?prefix ?namespace WHERE { [] sh:namespace ?namespace ; sh:prefix ?prefix} ORDER BY ?prefix`)
			.then(response => response.json())
			.then(json => json.results.bindings.forEach(b => {
				this.prefixes.set(b.prefix.value, b.namespace.value);
			}))
			.then((x) => {
				this.yasgui.config.yasr.prefixes = Object.fromEntries(this.prefixes);
				this.yasgui.getTab().yasr.config.prefixes = Object.fromEntries(this.prefixes);
				// Yasgui.Yasr.defaults.prefixes = Object.fromEntries(this.prefixes);
				console.log(this.prefixes);

				// Button to add prefixes to the query
				addPrefBtnEl.addEventListener('click', () => {
					const sortedPrefixes = {};
					for (let key of [...this.prefixes.keys()].sort()) {
						sortedPrefixes[key] = this.prefixes.get(key);
					}
					this.yasgui.getTab().yasqe.addPrefixes(sortedPrefixes);
					this.yasgui.getTab().yasqe.collapsePrefixes(true);
				});
			});

		// Add SPARQL query examples
		this.exampleQueries = [];
		if (exampleQueriesEl) this.addExampleQueries(exampleQueriesEl);

		// Parse query params from URL and auto run if query provided
		this.urlParams = {};
		if (window.location.search) {
			const regex = /[?&]([^=&]+)=([^&]*)/g;
			let match;
			while (match = regex.exec(window.location.search)) {
				const key = decodeURIComponent(match[1]);
				const value = decodeURIComponent(match[2]);
				this.urlParams[key] = value;
			}
		}
		// NOTE: Yasqe already automatically load query param in the editor
		if (this.urlParams.query) {
			this.addCommonPrefixesToQuery();
			this.yasgui.getTab().yasqe.query();
		}
	}

	// https://github.com/zazuko/Yasgui/blob/main/packages/yasqe/src/autocompleters/classes.ts#L8
	voidClassCompleter = {
		name: "voidClass",
		bulk: true,
		get: (yasqe, token) => {
				const sparqlQuery = "PREFIX void: <http://rdfs.org/ns/void#> SELECT DISTINCT ?class { [] void:class ?class } ORDER BY ?class ";
				return fetch(this.endpointUrl + '?format=csv&ac=1&query=' + encodeURIComponent(sparqlQuery))
						.then((response) => response.text())
						.then(function(text) {
								var data = text.split('\n').filter(item => item !== "");
								data.shift();
								return data;
						})
						.catch((error) => console.error('Error retrieving autocomplete for classes:', error));
		},
	}
	voidPropertyCompleter = {
		name: "voidProperty",
		bulk: true,
		get: (yasqe, token) => {
				const sparqlQuery = "PREFIX void: <http://rdfs.org/ns/void#> SELECT DISTINCT ?property { [] void:linkPredicate|void:property ?property } ORDER BY ?property";
				return fetch(this.endpointUrl + '?format=csv&ac=1&query=' + encodeURIComponent(sparqlQuery))
						.then((response) => response.text())
						.then(function(text) {
								var data = text.split('\n').filter(item => item !== "");
								data.shift();
								return data;
						})
						.catch((error) => console.error('Error retrieving autocomplete for properties:', error));
		},
	}

	addCommonPrefixesToQuery() {
		// Add prefixes to example queries
		const val = this.yasgui.getTab().yasqe.getValue();
		const sortedKeys = [...this.prefixes.keys()].sort();
		for (let key of sortedKeys) {
			const value = this.prefixes.get(key);
			let pref = {};
			pref[key] = value;
			var prefix = 'PREFIX ' + key + ' ?: ?<' + value;
			if (!new RegExp(prefix, 'g').test(val) && new RegExp('[(| |\u00a0|/|^]' + key + ':', 'g').test(val)) {
				this.yasgui.getTab().yasqe.addPrefixes(pref);
			}
		};
	}

	addTab(query, index) {
		this.yasgui.addTab(
			true,
			{
				...Yasgui.Tab.getDefaults(),
				name: `Query ${index+1}`,
				yasqe: {value: query}
			}
		);
		this.addCommonPrefixesToQuery();
	}

	ensureLimit(query) {
    const limitPattern = /LIMIT\s+\d+\s*$/i;
    const trimmedQuery = query.trim();
    if (!limitPattern.test(trimmedQuery)) {
        return trimmedQuery + " LIMIT 1000";
    }
    return trimmedQuery;
	}

	addExampleQueries(exampleQueriesEl) {
		const getQueryExamples = `PREFIX sh: <http://www.w3.org/ns/shacl#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
SELECT DISTINCT ?comment ?query WHERE {
	?sq a sh:SPARQLExecutable ;
			rdfs:label|rdfs:comment ?comment ;
			sh:select|sh:ask|sh:construct|sh:describe ?query .
} ORDER BY ?sq`;
		fetch(`${this.endpointUrl}?format=json&ac=1&query=${encodeURIComponent(getQueryExamples)}`)
			.then(response => response.json())
			.then(json => json.results.bindings.forEach(b => {
				this.exampleQueries.push({comment: b.comment.value, query: b.query.value});
			}))
			.then((x) => {
				// console.log(this.exampleQueries);
				if (this.exampleQueries.length === 0) return;

				// Add title for examples
				const exQueryTitleDiv = document.createElement("div");
				exQueryTitleDiv.style.textAlign = "center";
				const exQueryTitle = document.createElement("h3");
				exQueryTitle.style.margin = "0.1em";
				exQueryTitle.style.fontWeight = "200";
				exQueryTitle.textContent = "Examples";
				exQueryTitleDiv.appendChild(exQueryTitle);
				exampleQueriesEl.appendChild(exQueryTitleDiv);

				// Create dialog for examples
				const exQueryDialog = document.createElement("dialog");
				exQueryDialog.style.margin = "1em";
				exQueryDialog.style.borderColor = "#cccccc";
				exQueryDialog.style.backgroundColor = "#f5f5f5";
				exQueryDialog.style.borderRadius = "10px";

				// Add button to close dialog
				const exDialogCloseBtn = document.createElement("button");
				exDialogCloseBtn.textContent = "Close";
				exDialogCloseBtn.style.position = "fixed";
				exDialogCloseBtn.style.top = "2em";
				exDialogCloseBtn.style.right = "2em";
				exQueryDialog.appendChild(exDialogCloseBtn);
				exampleQueriesEl.appendChild(exQueryDialog);

				// Add examples to the main page and dialog
				this.exampleQueries.forEach((example, index) => {
					const exQueryDiv = document.createElement("div");
					const exQueryP = document.createElement("p");
					exQueryP.style.fontSize = "0.9em";
					exQueryP.innerHTML = `${index+1}. ${example.comment}`;

					// Create use button
					const button = document.createElement("button");
					button.textContent = "Use";
					button.style.marginLeft = "0.5em";
					button.className = "sparqlExampleButton";
					button.addEventListener("click", () => {
						this.addTab(example.query, index);
						exQueryDialog.close();
					});
					exQueryP.appendChild(button);
					exQueryDiv.appendChild(exQueryP);
					exQueryDialog.appendChild(exQueryDiv);

					// Add only the first examples to the main page
					if (index < this.examplesOnMainPage) {
						const cloneExQueryDiv = exQueryDiv.cloneNode(true);
						// Cloning does not include click event so we need to redo it :(
						cloneExQueryDiv.lastChild.lastChild.addEventListener("click", () => {
							this.addTab(example.query, index);
						});
						exampleQueriesEl.appendChild(cloneExQueryDiv)
					};

					// Add query to dialog using pre/code (super fast)
					const exQueryPre = document.createElement("pre");
					const exQueryCode = document.createElement("code");
					exQueryCode.className = "language-sparql hljs";
					exQueryPre.style.backgroundColor = "#cccccc";
					exQueryPre.style.padding = "0.1em";
					exQueryCode.textContent = example.query.trim();
					exQueryPre.appendChild(exQueryCode);
					exQueryDialog.appendChild(exQueryPre);

					// Create a YASQE fancy editor for each example in dialog (super slow)
					// const exYasqeDiv = document.createElement("div");
					// exYasqeDiv.id = `exYasqeDiv${index}`;
					// exQueryDialog.appendChild(exYasqeDiv);
					// // https://github.com/zazuko/Yasgui/blob/main/packages/yasqe/src/defaults.ts
					// new Yasqe(exYasqeDiv, {
					// 	value: example.query,
					// 	showQueryButton: false,
					// 	resizeable: false,
					// 	readOnly: true,
					// 	queryingDisabled: true,
					// 	persistent: null,
					// 	editorHeight: `${example.query.split(/\r\n|\r|\n/).length*2.5}ch`,
					// 	syntaxErrorCheck: false,
					// 	createShareableLink: null,
					// 	consumeShareLink: null,
					// });

				})

				// Add button to open dialog
				const openExDialogBtn = document.createElement("button");
				openExDialogBtn.textContent = "See all examples";
				exampleQueriesEl.appendChild(openExDialogBtn);

				openExDialogBtn.addEventListener("click", () => {
					exQueryDialog.showModal();
					// exQueryDialog.scrollTop = 0;
				});
				exDialogCloseBtn.addEventListener("click", () => {
					exQueryDialog.close();
				});
				hljs.highlightAll();
			});
	}
}

// TODO: check how we can edit the table results to add a button to run a DESCRIBE query on each cell
// https://github.com/zazuko/Yasgui/blob/main/packages/yasr/src/plugins/table/index.ts#L76
// https://datatables.net/extensions/buttons/
