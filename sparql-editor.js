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
	 * @param {HTMLElement} editorElem - Element where the SPARQL editor will be created
	 * @param {HTMLElement} resultsElem - Element where the SPARQL results will be displayed
	 * @param {HTMLElement} addPrefixesElem - Element where the button to add prefixes to the query will be created
	 */
	constructor(endpointUrl, editorElem, resultsElem, addPrefixesElem = null) {
		this.endpointUrl = endpointUrl;
		Yasqe.forkAutocompleter("class", this.voidClassCompleter);
		Yasqe.forkAutocompleter("property", this.voidPropertyCompleter);
		// Remove the original autocompleters for class and property
		Yasqe.defaults.autocompleters = Yasqe.defaults.autocompleters.filter(item => !["class", "property"].includes(item))

		this.yasqe = new Yasqe(editorElem, {
			requestConfig: {
				endpoint: endpointUrl,
				method: "GET",
			},
			showQueryButton: true,
			copyEndpointOnNewTab: true,
			resizeable: true,
		});
		this.yasr = new Yasr(resultsElem)

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
				if (addPrefixesElem) {
					// Button to add prefixes to the query
					addPrefixesElem.addEventListener('click', () => {
						const sortedPrefixes = {};
						for (let key of [...this.prefixes.keys()].sort()) {
							sortedPrefixes[key] = this.prefixes.get(key);
						}
						this.yasqe.addPrefixes(sortedPrefixes);
						this.yasqe.collapsePrefixes(true);
					});
				}
			});
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
			if (!new RegExp(prefix, 'g').test(val) && new RegExp('[(| |\u00a0|/]' + key + ':', 'g').test(val)) {
				this.yasqe.addPrefixes(pref);
			}
		};
	}
}

// NOTE: we could also use the Yasgui class directly
// const yasgui = new Yasgui(document.getElementById("yasgui"), {
//     requestConfig: { endpoint: endpointUrl },
//     copyEndpointOnNewTab: false,
// });
