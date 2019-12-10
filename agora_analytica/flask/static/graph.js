

graph = {
    width: parseInt(window.innerWidth),
    height: parseInt(window.innerHeight),

    nodes: [],
    links: [],
    topics: [],

    link_count: 3,
    node_radius: 15,
    distance: 30,
    strength: -30,
    distance_adaptive: true,
    collide: false,
    decay: true,
    alpha_decay: null,

    svg: null,

    zoom: null,
    simulation: null,
};

graph.reset = function() {
    graph.svg
        .attr("width", graph.width)
        .attr("height", graph.height);

    graph.simulation.force("charge").strength(graph.strength)

    graph.simulation.force("link")
        .links(graph.links);

    graph.simulation.force("collide")
        .radius(graph.node_radius)
        .strength(0.7 * graph.collide)

    graph.simulation.alphaDecay( 0.01 * graph.decay)

    graph.svg.selectAll("defs image.node-image")
        .attr("width", graph.node_radius * 2)
        .attr("height", graph.node_radius * 2),
    graph.svg.selectAll(".nodes circle")
        .attr("r", graph.node_radius)

    graph.simulation.alpha(1).restart();
}

function process_nodes(data) {
    graph.nodes = data
}

function process_links(data) {
    let LinksMap = function() {
        null
    }

    LinksMap.prototype.add = function(s,t,el) {
        links_map[s] = (s in links_map) ? links_map[s] : 0
        links_map[t] = (t in links_map) ? links_map[t] : 0
        let p = links_map[s];
        let q = links_map[t];

        // If both nodes have enought links, skip
        if(p >= graph.link_count && q >= graph.link_count) return false;

        links_map[s] += 1;
        links_map[t] += 1;
        graph.links.push(el)

        if (el['source_term']) {
            graph.topics.push({
                source: s,
                target: t,
                term: el['source_term']
            });
        }
        if (el['target_term']) {
            graph.topics.push({
                source: t,
                target: s,
                term: el['target_term']
            });
        }
    }

    let links_map = new LinksMap()

    data.sort((a, b) => a["distance"] - b["distance"] ).forEach((element) => {
        links_map.add(element.source, element.target, element)
    });

}

function graph_filter(filter_rules) {
    console.log("Filteröidään:", filter_rules);
    graph.svg.selectAll("g.nodes g.node").each(function(data) {
        for(rule in filter_rules) {
            // If any of rules matched, this node is to be hidden.
            if(filter_rules[rule].includes(data[rule])) {
                d3.select(this).classed("filtered", true);
                // No need for further processing.
                return
            }

        }
        // No rule matched, can be shown
        d3.select(this).classed("filtered", false);

    });
}

function node_color(d) {
    let party = parties.find(function(x) {
        if("itemLabel" in x && x.itemLabel.includes(d.party)) return true; 
        if("itemAltLabel" in x) return x.itemAltLabel.includes(d.party)
    });
    let color = party && "sRGB_color_hex_triplet" in party ? "#"+party.sRGB_color_hex_triplet : "#CCC"

    return color;
}

function graph_run() {
    if(graph.nodes.length == 0 || graph.links.length == 0 || parties.length == 0) return;

    // Link into nodes.
    graph.svg = d3.select("svg.graph")
    graph.svg.classed("running", true)
    graph.svg.select("g.tree").remove()

    let nodes = graph.nodes;
    let links = graph.links;

    var defs = graph.svg.append("defs");
    defs.append("clipPath")
        .attr("id", "clip-circle")
        .append("circle")
            .attr("cx", 0)
            .attr("cy", 0)

    for(n of nodes) {
        defs.append("pattern")
            .attr("id", "node-"+n.id+"-image")
            .attr("width", "100%")
            .attr("height", "100%")
            .append("image")
                .classed("node-image", true)
                .attr("preserveAspectRatio", "xMidYMid slice")
                .attr("xlink:href", n.image ? n.image : default_image)
                .attr("width", graph.node_radius * 2) 
                .attr("height", graph.node_radius * 2)
    }

    graph.zoom = d3.zoom()
        .on("zoom", function () {
            graph_layer.attr("transform", d3.event.transform)
        });

    let graph_layer = graph.svg.call(graph.zoom).append("g").attr("id", "graph_layer");

    graph.simulation = d3.forceSimulation();
    graph.alpha_decay = 1. - Math.pow(0.001, 1/(300 + (nodes.length * 2)))

    let force_link = d3.forceLink()
        .distance(function(d) {
            /* Distance calculation */
            let distance = d.distance * graph.distance;
            if(graph.distance_adaptive) distance = distance * Math.sqrt(nodes.length)
            distance += (graph.node_radius * 2)
            return distance
        })
        .id(function(d) { return d.id })

    graph.simulation
        .force("link", force_link)
        .force("center", d3.forceCenter(graph.width / 2, graph.height / 2))
        .force("charge", d3.forceManyBody())
        .force("collide", d3.forceCollide(graph.node_radius))

        // Jos halutaan pallon muotoinen
        // .force("x", d3.forceX())
        // .force("y", d3.forceY())

    graph.simulation
        .nodes(graph.nodes)
        .on("tick", ticked)

    var link = graph_layer.append("g")
        .attr("class", "links")
        .selectAll("line")
        .data(graph.links)
        .enter()
            .append("line")

    var node = graph_layer.append("g")
        .attr("class", "nodes")
        .selectAll("g")
        .data(nodes)
        .enter().append("g")
            .attr("class", "node")
            .attr("id", (d) => "node-"+d.id)
        .on("mouseover", function() {
            // SVG uses ordered rendering. Move focused element to top
            // of node list.
            let e = d3.select(this)
            e.classed("hover", true).raise();
        }).on("mouseout", function() {
            d3.select(this).classed("hover", false)
        });

    var circles = node.append("circle")
        .attr("r", graph.node_radius)
        .attr("stroke", node_color)
        .attr("fill", (d) => "url(#node-"+ d.id +"-image)")
        .on("click", function(obj) {
            show_node_info(obj.id)
            let g = d3.select(this.parentElement);

            var toggle = !g.classed("active");
            g.classed("active", toggle);
        });

    const topics = graph.topics;
    let topic_nodes = node.select(function(e) {
        let g = d3.select(this);

        g.selectAll().append("g")
            /* Topics pointing to target */
            .data(topics.filter(function(x) { return x.target == g.data()[0].id }))
            .enter().append("g")
                .classed("topic", true)
                .append("text")
                    .text((d) => d.term)
    });

    node.on("mouseover.reposition_topic", function() {
        /* Topic texts are hidden by default, and position is not updated for them in simulation.
           Update positions by event trigger. */
        d3.select(this).selectAll("g.topic").each(function(e){align_topic_texts(this)})

        const self = d3.select(this).data()[0]
        graph.links.filter(function(d) { return d.source == self || d.target == self }).forEach(function(e) {
            console.log(d3.select(e.target))
            if(self == d3.select(e.target))
                d3.select(each.target).classed("related", True)
        });
    });

    var labels = node.append("text")
        .text(function(d) {
            return d.name + "\r\n(" + d.party +")";
        })
        .classed("node-info", true)
        .attr('x', graph.node_radius)
        .attr('y', graph.node_radius);

    node.append("title")
        .text(function(d) { return d.id+": "+d.name+"\n"+d.party+"\n"+d.constituency; });


            
    function ticked() {
        graph.svg.classed("cooled", this.alpha() <= Math.max(this.alphaMin(), 0.05))

        link
            .attr("x1", function(d) { return d.source.x; })
            .attr("y1", function(d) { return d.source.y; })
            .attr("x2", function(d) { return d.target.x; })
            .attr("y2", function(d) { return d.target.y; });

        node.attr("transform", function(d) {
            return "translate(" + d.x + "," + d.y + ")";
        })
        node.selectAll("g.topic").each(function(e){ align_topic_texts(this)})
    }

    function align_topic_texts(el) {
        d3.select(el).attr("transform", function(d) {

            const source = nodes.find((x) => x.id == d.source)
            const target = nodes.find((x) => x.id == d.target)
            const atan = Math.atan2(source.y - target.y, source.x - target.x)
            if(d3.select(this).style("display") == "none") return
            const w = this.getBBox();

            // Align
            const s = Math.sin(atan)
            const c = Math.cos(atan)
            let y = s * (graph.node_radius)
            let x = c * (graph.node_radius)
            // Center point is bottom left, make it "center"
            y += w.height / 2;
            x -= w.width / 2;
            // Push outside regarding box size
            y += w.height / 2 * s;
            x += w.width / 2 * c;

            return "translate("+ x +","+ y +")"
        });
    }

    node.call(d3.drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended))

    function dragstarted(d) {
        if (!d3.event.active) graph.simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
    }

    function dragged(d) {
        d.fx = d3.event.x;
        d.fy = d3.event.y;
    }

    function dragended(d) {
        if (!d3.event.active) graph.simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
    }

    d3.select(window).on("resize", function() {
        graph.width = parseInt(window.innerWidth);
        graph.height = parseInt(window.innerHeight);

        graph.svg.attr("width", graph.width)
                 .attr("height", graph.height);
    });
    graph.reset();

}
