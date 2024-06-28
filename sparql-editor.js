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
	 * @param {HTMLElement} resultsEl - Element where the SPARQL results will be displayed
	 * @param {HTMLElement} addPrefixesEl - Element where the button to add prefixes to the query will be created
	 * @param {HTMLElement} exampleQueriesEl - Element where the SPARQL query examples will be displayed
	 * @param {number} examplesOnMainPage - Number of examples to display on the main page
	 */
	constructor(endpointUrl, editorEl, resultsEl, addPrefixesEl = null, exampleQueriesEl = null, examplesOnMainPage = 13) {
		this.endpointUrl = endpointUrl;
		this.examplesOnMainPage = examplesOnMainPage;
		Yasqe.forkAutocompleter("class", this.voidClassCompleter);
		Yasqe.forkAutocompleter("property", this.voidPropertyCompleter);
		// Remove the original autocompleters for class and property
		Yasqe.defaults.autocompleters = Yasqe.defaults.autocompleters.filter(item => !["class", "property"].includes(item))

		this.yasqe = new Yasqe(editorEl, {
			requestConfig: {
				endpoint: endpointUrl,
				method: "GET",
			},
			showQueryButton: true,
			copyEndpointOnNewTab: true,
			resizeable: true,
		});
		this.yasr = new Yasr(resultsEl)

		this.yasqe.on("query", (y) => {
			// Results will also use additional prefixes from the query
			this.yasr.config.prefixes = {...this.yasr.config.prefixes, ...y.getPrefixesFromQuery()};
		});
		this.yasqe.on("queryResponse", (y, response, duration) => {
			this.yasr.setResponse({
				data: response.text,
				status: response.statusCode,
				executionTime: duration,
			});
		});
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
				this.yasr.config.prefixes = Object.fromEntries(this.prefixes);
				console.log(this.prefixes);
				if (addPrefixesEl) {
					// Button to add prefixes to the query
					addPrefixesEl.addEventListener('click', () => {
						const sortedPrefixes = {};
						for (let key of [...this.prefixes.keys()].sort()) {
							sortedPrefixes[key] = this.prefixes.get(key);
						}
						this.yasqe.addPrefixes(sortedPrefixes);
						this.yasqe.collapsePrefixes(true);
					});
				}
			});

		// Add SPARQL query examples
		this.exampleQueries = [];
		if (exampleQueriesEl) this.addExampleQueries(exampleQueriesEl);
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
		// Not used atm, it is to add prefixes for example queries
		const val = this.yasqe.getValue();
		const sortedKeys = [...this.prefixes.keys()].sort();
		for (let key of sortedKeys) {
			const value = this.prefixes.get(key);
			let pref = {};
			pref[key] = value;
			var prefix = 'PREFIX ' + key + ' ?: ?<' + value;
			if (!new RegExp(prefix, 'g').test(val) && new RegExp('[(| |\u00a0|/|^]' + key + ':', 'g').test(val)) {
				this.yasqe.addPrefixes(pref);
			}
		};
	}

	addExampleQueries(exampleQueriesElem) {
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
				exampleQueriesElem.appendChild(exQueryTitleDiv);

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
				exampleQueriesElem.appendChild(exQueryDialog);

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
						this.yasqe.setValue(example.query);
						this.addCommonPrefixesToQuery();
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
							this.yasqe.setValue(example.query);
							this.addCommonPrefixesToQuery();
						});
						exampleQueriesElem.appendChild(cloneExQueryDiv)
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
				exampleQueriesElem.appendChild(openExDialogBtn);

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

// https://github.com/zazuko/Yasgui/blob/main/packages/yasr/src/plugins/table/index.ts#L76
// https://datatables.net/extensions/buttons/

// NOTE: we could also use the Yasgui class directly
// const yasgui = new Yasgui(document.getElementById("yasgui"), {
//     requestConfig: { endpoint: endpointUrl },
//     copyEndpointOnNewTab: false,
// });
