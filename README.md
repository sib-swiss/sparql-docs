# 🟥 Documenting a SPARQL endpoint @ SIB

Instructions on how to document SPARQL endpoints published at the Swiss Institute of Bioinformatics.

## 📚️ Publish SPARQL queries examples

1. Add each query to your triplestore folder in the `examples` folder at https://github.com/sib-swiss/sparql-examples (see the repository readme for more details on the format and scripts to use)
2. Generate the RDF file containing all SPARQL examples and prefixes/namespaces described using SHACL, and upload this RDF to your triplestore. It is recommended to upload the RDF to a named graph composed of the SPARQL endpoint URL postfixed with `/.well-known/sparql-examples`

## 📈 Publish the VoID description

1. Generate useful statistics for your endpoint (VoID description) using the void-generator: https://github.com/JervenBolleman/void-generator. If you are using Virtuoso it is recommended to run it on the server using the JDBC connector (much faster)

2. Upload the generated RDF to your endpoint. It is recommended to upload the RDF to a named graph composed of the SPARQL endpoint URL postfixed with `/.well-known/void`

## 🦉 Publish the ontology with Widoco

1.  Make sure the following sections are covered:

   - Version, Authors, Contributors (e.g. emails), License, Contact Email.

   - Abstract

   - Introduction. Describe the ontology in a few sentences

   - Overview. Put Diagram of classes / properties etc

   - Section 3. Description

     1. Diagram (image which can be provided as URL in the ontology)
     2. Examples of Usage (links to tutorials, if any), links to example queries

   - Section 4. “Main WIDOCO business” - schema ontology classes + properties. Include examples wherever relevant using *skos:example* in the .owl file that will be parsed automatically

   - References. PubMed IDs / DOIs for the paper describing the ontology / RDF data (if any)

   - Acknowledgements

     > A full overview of metadata terms supported by WIDOCO is available [here](https://github.com/dgarijo/Widoco/blob/master/doc/metadataGuide/guide.md#metadata-usage-in-widoco-1), while an overview of best practices using WIDOCO can be found [here](https://dgarijo.github.io/Widoco/doc/bestPractices/index-en.html).

2. Publish the ontology RDF to your triplestore. It is recommended to upload the ontology to a named graph (the ontology URL).

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
    <button id="add-prefixes" style="margin-bottom: 0.3em;">Add common prefixes</button>
    <div id="sparql-editor"></div>
    <div id="sparql-results"></div>
    <script>
        const se = new SparqlEditor(
            "https://sparql.uniprot.org/sparql/",
            document.getElementById("sparql-editor"),
            document.getElementById("sparql-results"),
            document.getElementById("add-prefixes"),
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
