// Inspired from https://sparql.uniprot.org/sparql.js
// Note that we add `&ac=1` to all the queries for the prefixes to exclude these queries from stats
// Code for UniProt SPARQL examples https://sparql.uniprot.org/.well-known/sparql-examples

class SparqlEditor {

	constructor(endpointUrl, yasqeElem, yasrElem, addPrefixesElem = null) {
		this.endpointUrl = endpointUrl;
		Yasqe.forkAutocompleter("class", this.voidClassCompleter);
		Yasqe.forkAutocompleter("property", this.voidPropertyCompleter);
		// Remove the original autocompleters for class and property
		Yasqe.defaults.autocompleters = Yasqe.defaults.autocompleters.filter(item => !["class", "property"].includes(item))

		this.yasqe = new Yasqe(yasqeElem, {
			requestConfig: {
				endpoint: endpointUrl,
				method: "GET",
			},
			showQueryButton: true,
			copyEndpointOnNewTab: false,
			resizeable: true,
		});
		this.yasr = new Yasr(yasrElem)

		// this.yasqe.on("query", (y) => {
		// 	this.yasr.config.prefixes = y.getPrefixesFromQuery();
		// });
		this.yasqe.on("queryResponse", (y, response, duration) => {
			this.yasr.setResponse({
				data: response.text,
				status: response.statusCode,
				executionTime: duration
			});
		});
		this.prefixes = new Map([
			['up', 'http://purl.uniprot.org/core/'],
			['keywords', 'http://purl.uniprot.org/keywords/'],
			['uniprotkb', 'http://purl.uniprot.org/uniprot/'],
			['taxon', 'http://purl.uniprot.org/taxonomy/'],
			['ec', 'http://purl.uniprot.org/enzyme/'],
			['rdf', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#'],
			['rdfs', 'http://www.w3.org/2000/01/rdf-schema#'],
			['skos', 'http://www.w3.org/2004/02/skos/core#'],
			['owl', 'http://www.w3.org/2002/07/owl#'],
			['bibo', 'http://purl.org/ontology/bibo/'],
			['dc', 'http://purl.org/dc/terms/'],
			['xsd', 'http://www.w3.org/2001/XMLSchema#'],
			['faldo', 'http://biohackathon.org/resource/faldo#']
		]);
		fetch(`${this.endpointUrl}?format=json&ac=1&query=PREFIX sh:<http://www.w3.org/ns/shacl%23> SELECT ?prefix ?namespace WHERE { [] sh:namespace ?namespace ; sh:prefix ?prefix} ORDER BY ?prefix`)
			.then(response => response.json())
			.then(json => json.results.bindings.forEach(b => {
				this.prefixes.set(b.prefix.value, b.namespace.value);
				let pref = {};
				pref[b.prefix.value] = b.namespace.value;
			}))
			.then((x) => {
				this.yasr.config.prefixes = Object.fromEntries(this.prefixes);

				// Button to add prefixes to the query
				if (addPrefixesElem) {
					addPrefixesElem.addEventListener('click', () => {
						const sortedKeys = [...this.prefixes.keys()].sort();
						for (let key of sortedKeys) {
							const value = this.prefixes.get(key);
							let pref = {};
							pref[key] = value;
							this.yasqe.addPrefixes(pref);
						};
						this.yasqe.collapsePrefixes(true);
					});
				}
			});
	}

	// https://github.com/zazuko/Yasgui/blob/main/packages/yasqe/src/autocompleters/classes.ts#L8
	voidClassCompleter = {
		name: "voidClass",
		bulk: true,
		get: function(yasqe, token) {
				// console.log("YASSy", yasqe);
				const sparqlQuery = "PREFIX void: <http://rdfs.org/ns/void#> SELECT DISTINCT ?class { [] void:class ?class } ORDER BY ?class ";
				const url = this.endpointUrl + '?format=csv&ac=1&query=' + encodeURIComponent(sparqlQuery);
				// console.log('fetch from', url);
				return fetch(url)
						.then((response) => response.text())
						.then(function(text) {
								var data = text.split('\n').filter(item => item !== "");
								data.shift();
								return data;
						})
						.catch((error) => { console.error('Error:', error) });
		},
	}
	voidPropertyCompleter = {
		name: "voidProperty",
		bulk: true,
		get: function(yasqe, token) {
				const sparqlQuery = "PREFIX void: <http://rdfs.org/ns/void#> SELECT DISTINCT ?property { [] void:linkPredicate|void:property ?property } ORDER BY ?property";
				const url = this.endpointUrl + '?format=csv&ac=1&query=' + encodeURIComponent(sparqlQuery);
				return fetch(url)
						.then((response) => response.text())
						.then(function(text) {
								var data = text.split('\n').filter(item => item !== "");
								data.shift();
								return data;
						})
						.catch((error) => { console.error('Error:', error) });
		},
	}

	addCommonPrefixesToQuery() {
		// Not used atm, it is for example queries
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


// https://github.com/RDFLib/prez-ui/blob/781622441d0c2ecd60200088c0352e82c547cc61/src/views/SparqlView.vue#L102

// NOTE: we could also use the Yasgui class directly
// const yasgui = new Yasgui(document.getElementById("yasgui"), {
//     requestConfig: { endpoint: endpointUrl },
//     copyEndpointOnNewTab: false,
// });

