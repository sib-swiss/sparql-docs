# 🟥 Documenting a SPARQL endpoint @ SIB

Instructions on how to document SPARQL endpoints published at the Swiss Institute of Bioinformatics.

## 📚️ Publish SPARQL queries examples

1. Add each query to your triplestore folder in the `examples` folder at https://github.com/sib-swiss/sparql-examples
2. Generate the RDF file containing all SPARQL examples and prefixes/namespaces described using SHACL, and upload this RDF to your triplestore. 

It is recommended to upload the RDF to a named graph composed of the SPARQL endpoint URL postfixed with `/.well-known/sparql-examples`

## 📈 Publish the VoID description

1. Generate the VoID description using the void-generator: https://github.com/JervenBolleman/void-generator. If you are using Virtuoso it is recommended to run it on the server using the JDBC connector (much faster)

2. Upload the generated RDF to your endpoint. 

It is recommended to upload the RDF to a named graph composed of the SPARQL endpoint URL postfixed with `/.well-known/void`

## 🦉 Publish the ontology with Widoco

1. Use `widoco` supported predicates such as `widoco:introduction` and `vann:example` 

2. Publish the ontology to your triplestore. It is recommended to upload the ontology to a named graph (the ontology URL). 

3. Generate and publish the website HTML: 

   1. Download `widoco.jar` file from https://github.com/dgarijo/Widoco/releases

   2. Then run this command providing your ontology file:

      ```bash
      java -jar ./widoco.jar -ontFile YOUR_ONTOLOGY.ttl -rewriteAll -webVowl -doNotDisplaySerializations -uniteSections -noPlaceHolderText -outFolder out
      ```

## 💫 Optional: deploy a SPARQL editor using YASGUI

> [!WARNING]
>
> Experimental

Docs: https://docs.triply.cc/yasgui-api/ using the updated fork at https://github.com/zazuko/Yasgui

Checkout the `index.html` file in this repository for a complex example.

Add the `sparql-editor.js` file from this repository to your web setup, and import it alongside YASGUI dependencies:

```html
<head>
	<link href="https://unpkg.com/@zazuko/yasgui@4/build/yasgui.min.css" rel="stylesheet" type="text/css" />
    <script src="https://unpkg.com/@zazuko/yasgui@4/build/yasgui.min.js"></script>
    <script src="/sparql-editor.js"></script>
</head>
```

Add the YASGUI editor and result window in your HTML:

```html
<body>
    <button id="addPrefix">Add common prefixes</button>
    <div id="yasqe"></div>
    <div id="yasr"></div>
    <script>
        const se = new SparqlEditor(
            "https://sparql.uniprot.org/sparql/",
            document.getElementById("yasqe"),
            document.getElementById("yasr"),
            document.getElementById('addPrefix')
        );
    </script>
    <style>
        button.yasqe_share {
            display: none !important;
        }
        .yasr .rowNumber {
            text-align: left;
        }
        .yasr .dataTable {
            font-size: 0.9em;
        }
    </style>
</body>
```

> You can test the `index.html` provided in this repository with:
>
> ```bash
> python -m http.server
> ```
