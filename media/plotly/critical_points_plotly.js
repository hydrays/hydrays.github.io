(function () {
    "use strict";

    const PlotlyLib = window.Plotly;
    const surfacePlot = document.getElementById("surface-plot");
    const slider1 = document.getElementById("slider-lambda1");
    const slider2 = document.getElementById("slider-lambda2");
    const sliderTheta = document.getElementById("slider-theta");
    const value1 = document.getElementById("value-lambda1");
    const value2 = document.getElementById("value-lambda2");
    const valueTheta = document.getElementById("value-theta");
    const state = {
        lambda1: 1.20,
        lambda2: 0.80,
        thetaDeg: 18,
        extent: 1.55,
        resolution: 61
    };

    if (!PlotlyLib || !surfacePlot || !slider1 || !slider2 || !sliderTheta || !value1 || !value2 || !valueTheta) {
        document.body.innerHTML = "<div style='padding:24px;color:#ffe4b6;font:16px/1.7 Georgia,serif;'>Plotly failed to load. If the browser blocks local files, serve the folder over HTTP and reload.</div>";
        throw new Error("Plotly demo failed to boot");
    }

    syncLabels();
    render();

    slider1.addEventListener("input", () => {
        state.lambda1 = Number.parseFloat(slider1.value);
        syncLabels();
        render();
    });

    slider2.addEventListener("input", () => {
        state.lambda2 = Number.parseFloat(slider2.value);
        syncLabels();
        render();
    });

    sliderTheta.addEventListener("input", () => {
        state.thetaDeg = Number.parseFloat(sliderTheta.value);
        syncLabels();
        render();
    });

    function syncLabels() {
        value1.textContent = numberText(state.lambda1);
        value2.textContent = numberText(state.lambda2);
        valueTheta.textContent = `${Math.round(state.thetaDeg)}°`;
    }

    function render() {
        const grid = buildSurfaceGrid();
        const curves = buildEigenCurves();
        const zRange = Math.max(Math.abs(grid.minZ), Math.abs(grid.maxZ), 0.8);
        const camera = surfacePlot.layout && surfacePlot.layout.scene
            ? surfacePlot.layout.scene.camera
            : { eye: { x: 1.55, y: 1.45, z: 1.12 } };

        PlotlyLib.react(surfacePlot, [
            {
                type: "surface",
                x: grid.xs,
                y: grid.ys,
                z: grid.z,
                showscale: false,
                opacity: 0.96,
                colorscale: [
                    [0, "rgb(82, 148, 246)"],
                    [0.5, "rgb(238, 241, 244)"],
                    [1, "rgb(243, 181, 99)"]
                ],
                hovertemplate: "x=%{x:.2f}<br>y=%{y:.2f}<br>f=%{z:.3f}<extra></extra>",
                lighting: {
                    ambient: 0.72,
                    diffuse: 0.88,
                    roughness: 0.45,
                    specular: 0.28
                },
                lightposition: { x: 100, y: 160, z: 120 }
            },
            axisLine([-state.extent, state.extent], [0, 0], [0, 0], "#ff9a8f"),
            axisLine([0, 0], [-state.extent, state.extent], [0, 0], "#7ab8ff"),
            axisLine([0, 0], [0, 0], [-zRange, zRange], "#74ddbf"),
            eigenCurveTrace(curves.u, "#72d1c2", "u"),
            eigenCurveTrace(curves.v, "#ff8a8a", "v"),
            {
                type: "scatter3d",
                mode: "markers",
                x: [0],
                y: [0],
                z: [0],
                marker: { color: "#ffffff", size: 4 },
                hovertemplate: "critical point at the origin<extra></extra>",
                showlegend: false
            }
        ], {
            margin: { l: 0, r: 0, t: 0, b: 0 },
            paper_bgcolor: "rgba(0,0,0,0)",
            plot_bgcolor: "rgba(0,0,0,0)",
            showlegend: false,
            uirevision: "quadratic-critical-point-surface",
            scene: {
                bgcolor: "rgba(0,0,0,0)",
                aspectmode: "cube",
                camera,
                xaxis: axisStyle("x"),
                yaxis: axisStyle("y"),
                zaxis: axisStyle("f(x,y)")
            }
        }, {
            responsive: true,
            displaylogo: false,
            modeBarButtonsToRemove: ["lasso2d", "select2d", "toImage"]
        });
    }

    function buildSurfaceGrid() {
        const xs = linspace(-state.extent, state.extent, state.resolution);
        const ys = linspace(-state.extent, state.extent, state.resolution);
        const z = [];
        let minZ = Infinity;
        let maxZ = -Infinity;

        for (let rowIndex = 0; rowIndex < ys.length; rowIndex += 1) {
            const row = [];
            for (let colIndex = 0; colIndex < xs.length; colIndex += 1) {
                const value = evaluate(xs[colIndex], ys[rowIndex]);
                row.push(value);
                minZ = Math.min(minZ, value);
                maxZ = Math.max(maxZ, value);
            }
            z.push(row);
        }

        return { xs, ys, z, minZ, maxZ };
    }

    function buildEigenCurves() {
        const ts = linspace(-state.extent, state.extent, 240);
        return {
            u: buildCurve(ts, "u"),
            v: buildCurve(ts, "v")
        };
    }

    function buildCurve(ts, which) {
        const x = [];
        const y = [];
        const z = [];

        for (let index = 0; index < ts.length; index += 1) {
            const t = ts[index];
            const point = which === "u" ? fromUV(t, 0) : fromUV(0, t);
            x.push(point.x);
            y.push(point.y);
            z.push(which === "u" ? 0.5 * state.lambda1 * t * t : 0.5 * state.lambda2 * t * t);
        }

        return { x, y, z };
    }

    function evaluate(x, y) {
        const rotated = rotateToUV(x, y);
        return 0.5 * (state.lambda1 * rotated.u * rotated.u + state.lambda2 * rotated.v * rotated.v);
    }

    function rotateToUV(x, y) {
        const angle = toRadians(state.thetaDeg);
        const c = Math.cos(angle);
        const s = Math.sin(angle);
        return {
            u: c * x + s * y,
            v: -s * x + c * y
        };
    }

    function fromUV(u, v) {
        const angle = toRadians(state.thetaDeg);
        const c = Math.cos(angle);
        const s = Math.sin(angle);
        return {
            x: c * u - s * v,
            y: s * u + c * v
        };
    }

    function toRadians(degrees) {
        return degrees * Math.PI / 180;
    }

    function linspace(min, max, count) {
        const result = [];
        const step = (max - min) / (count - 1);

        for (let index = 0; index < count; index += 1) {
            result.push(min + step * index);
        }

        return result;
    }

    function axisLine(x, y, z, color) {
        return {
            type: "scatter3d",
            mode: "lines",
            x,
            y,
            z,
            line: { color, width: 6 },
            hoverinfo: "skip",
            showlegend: false
        };
    }

    function eigenCurveTrace(curve, color, name) {
        return {
            type: "scatter3d",
            mode: "lines",
            x: curve.x,
            y: curve.y,
            z: curve.z,
            line: { color, width: 7 },
            hovertemplate: `${name}-eigen direction<extra></extra>`,
            showlegend: false
        };
    }

    function axisStyle(title) {
        return {
            title,
            color: "#d7e0e2",
            gridcolor: "rgba(255,255,255,0.08)",
            zerolinecolor: "rgba(255,255,255,0.15)",
            backgroundcolor: "rgba(255,255,255,0.02)",
            showbackground: true
        };
    }

    function numberText(value) {
        return Number(value).toFixed(2).replace(/\.?0+$/, "");
    }
}());
