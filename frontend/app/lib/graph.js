/* eslint-disable no-invalid-this */
import * as d3 from "d3";
import { binaryArrayIncludes } from "./utils.js";


class Graph {
  static #consts = {
    selectedClass: "selected",
    connectClass: "connect-node",
    nodeClassName: "node",
    graphClass: "graph",
    activeEditId: "active-editing",
    BACKSPACE_KEY: 8,
    DELETE_KEY: 46,
    ENTER_KEY: 13,
    nodeRadius: 50,
    newNodeIndicatorSize: 3 * 50,
  };

  #searchValue = "";
  #onHighlight = null;
  #onChange = null;
  #nodes = null;
  #links = null;
  #screenPosition = null;
  #initialNodePosition = null;
  svg = null;
  #idsOfAllNodesWithLinkedNote = null;


  #selection = {
    type: "null",
    value: null,
  };
  #mouseDownNode = null;
  #mouseDownLink = null;
  #justDragged = false;
  #justScaleTransGraph = false;
  #lastKeyDown = -1;
  #shiftDragInProgress = false;
  #selectedText = null;
  #graphMouseDown = false;

  constructor(svg, graphObject, onHighlight, onChange) {
    const thisGraph = this;
    thisGraph.#onHighlight = onHighlight;
    thisGraph.#onChange = onChange;

    thisGraph.#nodes = graphObject.nodes;
    thisGraph.#links = graphObject.links;
    thisGraph.#screenPosition = graphObject.screenPosition;
    thisGraph.#initialNodePosition = graphObject.initialNodePosition;

    thisGraph.svg = svg;
    thisGraph.mainSVGGroup = svg.append("g")
      .classed(Graph.#consts.graphClass, true);
    const mainSVGGroup = thisGraph.mainSVGGroup;

    thisGraph.initialNodePositionIndicator = mainSVGGroup.append("g")
      .classed("new-node-position-indicator", true)
      .append("rect");

    thisGraph.nodeHighlighterContainer = mainSVGGroup.append("g")
      .classed("note-highlighters", true);

    // displayed when dragging between nodes - should be rendered in front of
    // node highlighter circles, so this code is placed after node highlighter g
    // creation code
    thisGraph.newLinkLine = mainSVGGroup.append("svg:path")
      .attr("class", "link newLinkLine hidden")
      .attr("d", "M0,0L0,0");

    // svg nodes and links
    thisGraph.linksContainer = mainSVGGroup.append("g")
      .classed("links", true);

    thisGraph.nodesContainer = mainSVGGroup.append("g")
      .classed("notes", true);

    // drag single nodes, but not, if shift key is pressed
    thisGraph.nodeDrag = d3.drag()
      .subject(function(event) {
        return { x: event.x, y: event.y };
      })
      .filter(() => {
        return (!thisGraph.shiftKeyIsPressed) && (!thisGraph.ctrlKeyIsPressed);
      })
      .on("drag", (e, d) => {
        const thisGraph = this;
        thisGraph.#justDragged = true;
        d.position.x += e.dx;
        d.position.y += e.dy;
        thisGraph.#updateGraph();
        thisGraph.#onChange();
      })
      .on("end", function(e, d) {
        if (e.shiftKey) return;
        thisGraph.#select(d);
      });

    // drag intitial node position indicator
    thisGraph.inpIndicatorDrag = d3.drag()
      .subject(function(event) {
        return { x: event.x, y: event.y };
      })
      .on("drag", function(e) {
        thisGraph.#initialNodePosition.x += e.dx;
        thisGraph.#initialNodePosition.y += e.dy;
        thisGraph.#onChange();
        thisGraph.#updateGraph();
      });

    // listen for key events
    d3.select(window)
      .on("keydown", function(e) {
        thisGraph.#svgKeyDown(e);
      })
      .on("keyup", function(e) {
        thisGraph.#svgKeyUp(e);
      });
    svg.on("mousedown", function(e, d) {
      thisGraph.#svgMouseDown(d);
    });
    svg.on("mouseup", function(e, d) {
      thisGraph.#svgMouseUp(d);
    });
    svg.on("mousemove", function(e) {
      thisGraph.#newPathMove(e, thisGraph.#mouseDownNode);
    });

    // listen for dragging
    const zoom = d3.zoom();

    zoom.on("zoom", function(e) {
      if (e.shiftKey) {
        // TODO  the internal d3 state is still changing
        return false;
      } else {
        thisGraph.#zoomed(e);
      }
      return true;
    });

    zoom.on("start", function(e) {
      const ael = d3.select("#" + Graph.#consts.activeEditId).node();
      if (ael) {
        ael.blur();
      }
      if (!e.shiftKey) {
        d3.select("body").style("cursor", "move");
      }
    });
    svg.call(zoom).on("dblclick.zoom", null);

    // when creating the graph, a zoom end event is initially dispatched.
    // since this first one does not change anything, we don't want to fire the
    // onChange event
    let firstZoomEndHappened = false;

    zoom.on("end", function() {
      d3.select("body").style("cursor", "auto");
      if (firstZoomEndHappened) {
        thisGraph.#onChange();
      } else {
        firstZoomEndHappened = true;
      }
    });

    const initialZoomTranform = d3.zoomIdentity
      .translate(
        thisGraph.#screenPosition.translateX,
        thisGraph.#screenPosition.translateY,
      )
      .scale(thisGraph.#screenPosition.scale);
    zoom.transform(svg, initialZoomTranform);

    // listen for resize
    window.onresize = () => thisGraph.#updateWindow(svg);

    thisGraph.#updateConnectedNodeIds();

    thisGraph.#updateGraph();
  }


  #updateConnectedNodeIds() {
    const thisGraph = this;

    thisGraph.#idsOfAllNodesWithLinkedNote = thisGraph.#links
      .reduce((accumulator, link) => {
        accumulator.push(link.source.id);
        accumulator.push(link.target.id);
        return accumulator;
      }, [])
      .sort((a, b) => a - b);
  };


  #newPathMove(e, originNode) {
    const thisGraph = this;
    if (!thisGraph.#shiftDragInProgress) {
      return;
    }

    const newLinkEnd = {
      x: d3.pointer(e, thisGraph.mainSVGGroup.node())[0] - 1,
      y: d3.pointer(e, thisGraph.mainSVGGroup.node())[1] - 1,
    };

    thisGraph.newLinkLine.attr(
      "d",
      "M" + originNode.position.x + "," + originNode.position.y
      + "L" + newLinkEnd.x + "," + newLinkEnd.y,
    );
  };


  // insert svg line breaks: taken from
  // http://stackoverflow.com/questions/13241475/how-do-i-include-newlines-in-labels-in-d3-charts
  #insertTitleLinebreaks(gEl, title) {
    const words = (title && title.split(/\s+/g)) || "";
    const nwords = words.length;
    const el = gEl.append("text")
      .attr("text-anchor", "middle")
      .attr("dy", "-" + (Math.max(nwords, 1) - 1) * 7.5);

    for (let i = 0; i < words.length; i++) {
      const tspan = el.append("tspan").text(words[i]);
      if (i > 0) {tspan.attr("x", 0).attr("dy", "15");}
    }
  };


  // remove links associated with a node
  // this method is currently not used
  #spliceLinksForNode(node) {
    const thisGraph = this;
    const toSplice = thisGraph.#links.filter(function(l) {
      return (l.source === node || l.target === node);
    });
    toSplice.map(function(l) {
      return thisGraph.#links.splice(thisGraph.#links.indexOf(l), 1);
    });
  };


  #select(value) {
    const thisGraph = this;
    if (!value) {
      thisGraph.#selection = {
        type: "null",
        value: null,
      };
      return;
    }
    thisGraph.#selection = {
      type: (value.source && value.target) ? "edge" : "node",
      value: value,
    };

    if (thisGraph.#selection.type !== "null") {
      thisGraph.#selection.connectedNodeIds
        = thisGraph.#selection.type === "node"
          ? thisGraph.#selection.value.linkedNotes.map((node) => node.id)
          : [value.source.id, value.target.id];
    }
  
    thisGraph.#updateGraph();
  };


  #handleMouseDownOnEdge(e, d3path, d) {
    const thisGraph = this;
    e.stopPropagation();
    thisGraph.#mouseDownLink = d;

    if (thisGraph.#selection) {
      thisGraph.#select(null);
    }

    const prevEdge = thisGraph.#selection.value;
    if (!prevEdge || prevEdge !== d) {
      thisGraph.#select(d);
    } else {
      thisGraph.#select(null);
    }
  };


  #handleMouseDownOnNode(e, d3node, d) {
    const thisGraph = this;
    e.stopPropagation();
    thisGraph.#mouseDownNode = d;
    if (e.shiftKey) {
      thisGraph.#shiftDragInProgress = e.shiftKey;
      // reposition dragged directed edge
      thisGraph.newLinkLine
        .classed("hidden", false)
        .attr(
          "d",
          "M" + d.position.x + "," + d.position.y
          + "L" + d.position.x + "," + d.position.y,
        );
    }
  };


  // mouseup on nodes
  #handleMouseUpOnNode(d3node, mouseUpNode) {
    const thisGraph = this;
    const consts = Graph.#consts;
    // reset the states
    thisGraph.#shiftDragInProgress = false;
    d3node.classed(consts.connectClass, false);

    const mouseDownNode = thisGraph.#mouseDownNode;

    if (!mouseDownNode) return;

    thisGraph.newLinkLine.classed("hidden", true);

    if (mouseDownNode !== mouseUpNode) {
      // we're in a different node:
      // create new edge for mousedown edge and add to graph
      const newEdge = { source: mouseDownNode, target: mouseUpNode };

      // check if such an edge is already there ...
      const edgeAlreadyExists = thisGraph
        .linksContainer
        .selectAll("path.link")
        .filter(
          function(d) {
            return (
              (d.source === newEdge.source && d.target === newEdge.target)
              || (d.source === newEdge.target && d.target === newEdge.source)
            );
          },
        )
        .size() !== 0;

      // ... if not, create it
      if (!edgeAlreadyExists) {
        thisGraph.#links.push(newEdge);
        thisGraph.#onChange();
        thisGraph.#updateConnectedNodeIds();
        thisGraph.#updateGraph();
      }
    } else {
      // we're in the same node
      if (thisGraph.#justDragged) {
        // dragged, not clicked
        thisGraph.#justDragged = false;
      } else {
        thisGraph.#select(mouseUpNode);
      }
    }
    thisGraph.#mouseDownNode = null;
  };


  // mousedown on main svg
  #svgMouseDown() {
    this.#graphMouseDown = true;
  };


  // mouseup on main svg
  #svgMouseUp() {
    const thisGraph = this;
    if (thisGraph.#justScaleTransGraph) {
      // dragged not clicked
      thisGraph.#justScaleTransGraph = false;
    }

    // on mouse up, shift drag is always over
    thisGraph.#shiftDragInProgress = false;
    thisGraph.newLinkLine.classed("hidden", true);

    thisGraph.#graphMouseDown = false;
  };


  // keydown on main svg
  #svgKeyDown(e) {
    const thisGraph = this;
    const consts = Graph.#consts;

    if (e.shiftKey) {
      thisGraph.shiftKeyIsPressed = true;
    }

    if (e.ctrlKey) {
      thisGraph.ctrlKeyIsPressed = true;
    }

    // make sure repeated key presses don't register for each keydown
    if (thisGraph.#lastKeyDown !== -1) return;

    thisGraph.#lastKeyDown = e.keyCode;

    const selection = thisGraph.#selection;

    switch (e.keyCode) {
    case consts.BACKSPACE_KEY:
    case consts.DELETE_KEY:
      // we cannot prevent default because then we cannot delete values from
      // search input
      // e.preventDefault();
      if (selection.type  === "node") {
        // right now, we don't support deleting nodes from the graph view
      } else if (selection.type === "edge") {
        thisGraph.#links.splice(thisGraph.#links.indexOf(selection.value), 1);
        thisGraph.#onChange();
        thisGraph.#select(null);
        thisGraph.#updateConnectedNodeIds();
        thisGraph.#updateGraph();
      }
      break;
    }
  };


  #svgKeyUp(e) {
    const thisGraph = this;
    thisGraph.shiftKeyIsPressed = e.shiftKey;
    thisGraph.ctrlKeyIsPressed = e.ctrlKey;

    this.#lastKeyDown = -1;
  };


  // call to propagate changes to graph
  #updateGraph() {
    const thisGraph = this;
    const consts = Graph.#consts;

    thisGraph.initialNodePositionIndicatorElement
      = thisGraph.initialNodePositionIndicator
        .attr("width", String(consts.newNodeIndicatorSize))
        .attr("height", String(consts.newNodeIndicatorSize))
        .attr("x",
          thisGraph.#initialNodePosition.x - (consts.newNodeIndicatorSize / 2),
        )
        .attr("y",
          thisGraph.#initialNodePosition.y - (consts.newNodeIndicatorSize / 2),
        )
        .attr("rx", 2)
        .attr("ry", 2)
        .call(thisGraph.inpIndicatorDrag);

    /** ********************
      node highlighter circles
    ***********************/

    // create selection
    thisGraph.nodeHighlighterElements = thisGraph.nodeHighlighterContainer
      .selectAll("g.node-highlighter");
    // append new node data
    thisGraph.nodeHighlighterElements = thisGraph.nodeHighlighterElements
      .data(
        // append only the nodes that are search hits
        thisGraph.#nodes.filter((node) => {
          if (typeof thisGraph.#searchValue !== "string") return false;
          if (thisGraph.#searchValue.length < 3) return false;
          return node.title.toLowerCase().includes(thisGraph.#searchValue);
        }),
        function(d) {return d.id;},
      )
      .attr(
        "transform",
        function(d) {
          return "translate(" + d.position.x + "," + d.position.y + ")";
        },
      );

    // add new node highlighters
    const nodeHighlighterEnter = thisGraph.nodeHighlighterElements
      .enter();

    nodeHighlighterEnter
      .append("g")
      .attr(
        "transform",
        function(d) {
          return "translate(" + d.position.x + "," + d.position.y + ")";
        },
      )
      .classed("node-highlighter", true)
      .append("circle")
      .attr("r", "320");

    // remove old node highlighters
    const nodeHighlighterExitSelection
      = thisGraph.nodeHighlighterElements.exit();
    nodeHighlighterExitSelection.remove();

    /** ********************
      links
    ***********************/

    // create link selection
    thisGraph.linkElements = thisGraph.linksContainer
      .selectAll("path.link")
      .data(
        thisGraph.#links,
        function(d) {
          return String(d.source.id) + "+" + String(d.target.id);
        },
      );

    // update existing links
    thisGraph.linkElements
      .classed(consts.selectedClass, function(edge) {
        if (!thisGraph.#selection) return false;
        return edge === thisGraph.#selection.value;
      })
      .attr("d", function(d) {
        return "M" + d.source.position.x + "," + d.source.position.y
          + "L" + d.target.position.x + "," + d.target.position.y;
      })
      .classed("selected", (edge) => {
        if (thisGraph.#selection.type !== "edge") return false;
        return thisGraph.#selection.value === edge;
      })
      .classed("connected-to-selected", (edge) => {
        if (thisGraph.#selection.type !== "node") return false;
        const selectedNodeId = thisGraph.#selection.value.id;
        return (
          edge.source.id === selectedNodeId
          || edge.target.id === selectedNodeId
        );
      });


    // add new links
    thisGraph.linkElements
      .enter()
      .append("path")
      .classed("link", true)
      .attr("d", function(d) {
        return "M" + d.source.position.x + "," + d.source.position.y
        + "L" + d.target.position.x + "," + d.target.position.y;
      })
      .on("mouseover", function(e, d) {
        thisGraph.#onHighlight(true, d.source.title + " - " + d.target.title);
      })
      .on("mouseout", function() {
        thisGraph.#onHighlight(false);
      })
      .on("mousedown", function(e, d) {
        thisGraph.#handleMouseDownOnEdge(e, d3.select(this), d);
      })
      .on("mouseup", function() {
        thisGraph.#mouseDownLink = null;
      });

    // remove old links
    thisGraph.linkElements
      = thisGraph.linkElements.exit().remove();

    /** ********************
      nodes
    ***********************/

    // create node selection
    thisGraph.nodeElements = thisGraph.nodesContainer.selectAll("g.node");

    // append new node data
    thisGraph.nodeElements = thisGraph.nodeElements
      .data(
        thisGraph.#nodes,
        function(d) {return d.id;},
      );

    // update existing nodes
    thisGraph.nodeElements
      .attr(
        "transform",
        function(d) {
          return "translate(" + d.position.x + "," + d.position.y + ")";
        },
      )
      .classed("unconnected", function(d) {
        return !binaryArrayIncludes(thisGraph.#idsOfAllNodesWithLinkedNote, d.id);
      })
      .classed("selected", (node) => {
        if (thisGraph.#selection.type !== "node") return false;
        return thisGraph.#selection.value.id === node.id;
      })
      .classed("connected-to-selected", (node) => {
        if (thisGraph.#selection.type === "null") return false;
        return thisGraph.#selection.connectedNodeIds.includes(node.id);
      });

    // add new nodes
    const nodeG = thisGraph.nodeElements
      .enter()
      .append("g")
      .classed(consts.nodeClassName, true)
      .classed("new", function(d) {
        const MAX_NEW_AGE = 1000 * 60 * 60 * 24 * 10; // 10 days
        return Date.now() - d.creationTime < MAX_NEW_AGE;
      })
      .classed("hub", function(d) {
        return d.linkedNotes.length > 7;
      })
      .classed("unconnected", function(d) {
        return !binaryArrayIncludes(thisGraph.#idsOfAllNodesWithLinkedNote, d.id);
      })
      .attr(
        "transform",
        function(d) {
          return "translate(" + d.position.x + "," + d.position.y + ")";
        },
      )
      .on("mouseover", function(e, d) {
        if (thisGraph.#shiftDragInProgress) {
          d3.select(this).classed(consts.connectClass, true);
        }
        thisGraph.#onHighlight(true, d.title);
      })
      .on("mouseout", function() {
        d3.select(this).classed(consts.connectClass, false);
        thisGraph.#onHighlight(false);
      })
      .on("mousedown", function(e, d) {
        thisGraph.#handleMouseDownOnNode(e, d3.select(this), d);
      })
      .on("mouseup", function(e, d) {
        thisGraph.#handleMouseUpOnNode(d3.select(this), d);
      })
      .on("click", function(e, d) {
        if (e.ctrlKey) {
          window.open("/?id=" + d.id, "_blank");
        }
      })
      .call(thisGraph.nodeDrag);

    nodeG.append("circle")
      .attr("r", String(consts.nodeRadius));

    nodeG.each(function(d) {
      thisGraph.#insertTitleLinebreaks(d3.select(this), d.title);
    });

    // currently it's not possible to remove nodes in Graph View
    /*
    // remove old nodes
    const nodeExitSelection = thisGraph.nodeElements.exit();
    nodeExitSelection.remove();
  */
  };


  #zoomed(e) {
    const thisGraph = this;

    this.#justScaleTransGraph = true;
    d3.select("." + Graph.#consts.graphClass)
      .attr(
        "transform",
        "translate("
        + e.transform.x + "," + e.transform.y + ") "
        + "scale(" + e.transform.k + ")",
      );

    thisGraph.#screenPosition.translateX = e.transform.x;
    thisGraph.#screenPosition.translateY = e.transform.y;
    thisGraph.#screenPosition.scale = e.transform.k;
  };


  #updateWindow(svg) {
    const docEl = document.documentElement;
    const bodyEl = document.getElementsByTagName("body")[0];
    const x = window.innerWidth || docEl.clientWidth || bodyEl.clientWidth;
    const y = window.innerHeight || docEl.clientHeight || bodyEl.clientHeight;
    svg.attr("width", x).attr("height", y);
  };


  /** *****************
    PUBLIC METHODS
  ********************/


  getSaveData() {
    const thisGraph = this;

    const linksToTransmit = thisGraph.#links.map((link) => {
      return [
        link.source.id,
        link.target.id,
      ];
    });

    const nodePositionUpdates = thisGraph.#nodes.map((node) => {
      return {
        id: node.id,
        position: node.position,
      };
    });

    const graphObject = {
      nodePositionUpdates,
      links: linksToTransmit,
      screenPosition: thisGraph.#screenPosition,
      initialNodePosition: thisGraph.#initialNodePosition,
    };

    return graphObject;
  };


  getSelectedNodeId() {
    const thisGraph = this;

    if (!thisGraph.#selection) {
      return null;
    }

    if (thisGraph.#selection.type !== "node") {
      return null;
    }

    return thisGraph.#selection.value;
  };


  setSearchValue(newSearchValue) {
    const thisGraph = this;
    if (typeof newSearchValue === "string") {
      thisGraph.#searchValue = newSearchValue;
    }
    thisGraph.#updateGraph();
  };
};


const initGraph = (parent, graphObject, onHighlight, onChange) => {
  const docEl = document.documentElement;
  const bodyEl = document.getElementsByTagName("body")[0];

  const width = window.innerWidth || docEl.clientWidth || bodyEl.clientWidth;
  const height = (
    window.innerHeight
    || docEl.clientHeight
    || bodyEl.clientHeight
  ) - 50;


  /** MAIN SVG **/
  const svg = d3.select(parent)
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  const graphInstance = new Graph(
    svg, graphObject, onHighlight, onChange,
  );

  return graphInstance;
};


export {
  initGraph,
};


