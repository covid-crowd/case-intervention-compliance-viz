import React from 'react';
import Plot from 'react-plotly.js';
// import logo from './logo.svg';
import './App.css';
import L from 'leaflet';
import { Map, TileLayer, GeoJSON } from 'react-leaflet'
import Papa from 'papaparse';
import {addDays, format, differenceInCalendarDays, isSaturday} from 'date-fns';

import * as topojson from 'topojson-client';

import counties from './data/counties-10m.json';
import cuebiq from './data/cmi-20200505.json';
window.cuebiq = cuebiq;

const COUNTIES_GEOJSON = topojson.feature(counties, counties.objects.counties)
  .features;
const STATES_GEOJSON = topojson.feature(counties, counties.objects.states)
  .features;

const STATE_BY_FIPS = new window.Map(STATES_GEOJSON
  .map(f => [f.id, f.properties.name]));
COUNTIES_GEOJSON.forEach(f => 
  f.properties.state = STATE_BY_FIPS.get(f.id.substr(0, 2)));
  
const TILES_URL = "https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png";
                  // "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
const ATTRIBUTION =
  '&copy; <a href="https://www.osm.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';
  // '&amp;copy <a href="http://osm.org/copyright">OpenStreetMap</a> contributors';
const CANVAS =  L.canvas({ padding: 0.6 });

const START_DATE = new Date(2020, 0, 22);

class App extends React.Component {
  render() {
    return (
      <div className="App">
        <VisMap />
      </div>
    );
  }
}

export default App;

const BOUNDS_US = [
  [50.4, -64.96],
  [50.4, -127.51],
  [22.4, -64.96],
  [22.4, -127.51],
];
// const MAX_BOUNDS_US = [
//   [55.4, -54.96],
//   [55.4, -137.51],
//   [17.4, -54.96],
//   [17.4, -137.51],
// ];


const BASE_FEATURE_STYLES = {
  weight: 1,
  fillOpacity: 1,
  smoothFactor: 0.5,
  color: '#ffffff',
};
const INVISIBLE_FEATURE_STYLES = {
  weight: 0,
  fillOpacity: 0,
  color: '#ffffff'
}

const VALUE_MAPPING = new window.Map([
  ["Less than a day ago", 0],
  ["Less than three days ago", 1],
  ["Less than a week ago", 2],
  ["Less than two weeks ago", 3],
  ["Two weeks ago or longer", 4],
  
  ["A few are not", 3],
  ["Some are not", 2],
  ["Many are not", 1],
  ["Almost all are not", 0]
]);

const DATALAYER_LABELS = new window.Map([
  ['cases.counts', "Cumulative confirmed cases"],
  ['cases.new', "Confirmed new cases"],
  ['cases.growth', "Confirmed case growth rate"],
  ['compliance.cia_1', "Time since last left house"],
  ['compliance.cia_2', "Time since last observed < 6ft"],
  ['compliance.cia_3', "Time since last personal < 6ft"],
  ['compliance.bts_1', "% others distancing, observed"],
  ['mobility.cmi', 'Mobility index'],
  ['mobility.sip', '% < 350ft from home'],
  ['mobility.l1m', '% < 1mi from home'],
  ['mobility.l10m', '% < 10mi from home'],
  ['mobility.observed_sip_date', 'Observed SIP date']
  
]);

const DATALAYER_LEGENDS = new window.Map([
  ['cases.counts', {min: "0", max: c => c.maxCases+" cases", steps: 4, minR: 100, maxR: 250}],
  ['cases.new', {min: "0", max: c => c.maxNewCases+" cases/day", steps: 4, minR: 100, maxR: 250}],
  ['cases.growth', {min: "dropping fast", max: "rising fast", steps: 4, minR: 100, maxR: 250}],
  ['compliance.cia_1', {min: "< 1 day", max: "> 2 weeks", steps: 5, minR: 150, maxR: 250}],
  ['compliance.cia_2', {min: "< 1 day", max: "> 2 weeks", steps: 5, minR: 150, maxR: 250}],
  ['compliance.cia_3', {min: "< 1 day", max: "> 2 weeks", steps: 5, minR: 150, maxR: 250}],
  ['compliance.bts_1', {min: "0%", max: "100%", steps: 4, minR: 100, maxR: 250}],
  ['mobility.cmi', {min:"0", max:"5", steps: 4, minR: 100, maxR: 250}],
  ['mobility.sip', {min:"0%", max:"100%", steps: 4, minR: 100, maxR: 250}],
  ['mobility.l1m', {min:"0%", max:"100%", steps: 4, minR: 100, maxR: 250}],
  ['mobility.l10m', {min:"0%", max:"100%", steps: 4, minR: 100, maxR: 250}],
  ['mobility.observed_sip_date', {min: "March 1", max: "April 15", steps: 45, minR: 0, maxR: 150}]
]);

// const DATALAYER_CONTROLS = new window.Map([
//   ['cases.counts', [{type: "slider", }]]
// ])

class VisMapLegend extends React.PureComponent {
  colorAt(i, steps, minR, maxR) {
    if (steps < 10) {
      return `rgb(${minR+(maxR-minR)*i/steps}, 200, 150)`
    } else {
      let v = `hsl(${Math.round(minR+(maxR-minR)*i/steps)}, 70%, 70%)`
      console.log("hsl!", v);
      return v;
    }
  }
  
  render() {
    let f2s = f => typeof(f) === 'function' ? f(this.props.countyData) : f;
    let {min, max, steps, minR, maxR, width} = this.props;
    let height = 10;
    let out = [];
    for (var i = 0; i < f2s(steps); i++) {
      out.push(<div className="segment" key={i} style={{background: this.colorAt(i, steps, minR, maxR), display: "inline-block", width: width/steps, height: height}}> </div>)
    }
    return <div className="legend" style={{width: width}}>
        {out}
        <span className="leftIndex" style={{position: "absolute", top: height+5, left: 0}}>{f2s(min)}</span>
        <span className="rightIndex" style={{position: "absolute", top: height+5, right: 0}}>{f2s(max)}</span>
      </div>
  }
}

class VisMapDateSlider extends React.PureComponent {
  render() {
    let {width, dayNumber, countyData: {maxDays, maxDaysMobility}, dataLayer} = this.props;
    let height = 10;
    let endDate = addDays(START_DATE, (dataLayer.startsWith('mobility.') ? maxDaysMobility : maxDays) || 0);
    return <div className="date-slider" style={{width: width, height: height + 20}}>
        <span className="display" style={{position: "absolute", top: 0, width: "100%", "text-align": "center" }}>{format(addDays(START_DATE, dayNumber), 'M/d/yyyy (EEEEEE)')}</span>
        <input type="range" style={{width: width}} min="0" max={(dataLayer.startsWith('mobility.') ? maxDaysMobility : maxDays) || 0} step="1" value={dayNumber} onChange={event => this.props.setDayNumber(event.target.value)} />
        <span className="leftIndex" style={{position: "absolute", top: height+10, left: 0}}>{format(START_DATE, 'M/d/yyyy')}</span>
        <span className="leftIndex" style={{position: "absolute", top: height+10, right: 0}}>{format(endDate, 'M/d/yyyy')}</span>
      </div>
  }
}

class VisMapMenu extends React.PureComponent {
  state = {
    showDropdown: false
  }
  
  render() {
    let legend_props = DATALAYER_LEGENDS.get(this.props.dataLayer)
    return (
      <div className="map-menu-container">
        <div className="legend-container">
          {(this.props.dataLayer.startsWith('cases.') || this.props.dataLayer.startsWith('mobility.')) && <VisMapDateSlider
            dataLayer={this.props.dataLayer}
            countyData={this.props.countyData}
            width={300}
            dayNumber={this.props.dayNumber}
            setDayNumber={this.props.setDayNumber} />}
          <VisMapLegend width={300} countyData={this.props.countyData} {...legend_props} />
        </div>
        <div className="map-display" onClick={() => this.setState({showDropdown: ! this.state.showDropdown})}>
          {DATALAYER_LABELS.get(this.props.dataLayer)} <span className="arrow">▼</span>
        </div>
        <div className={"map-select" + (this.state.showDropdown ? " visible" : "")}>
          <div className="map-option-header">Data Views</div>
          {Array.from(DATALAYER_LABELS.entries()).map(([k,v], i) => 
            <div className="map-option" key={i} onClick={() => this.props.setLayer(k)}>
              {k === this.props.dataLayer ? '⚫︎' : '⚪︎'} {v}
            </div>)}
        </div>
      </div>
    )
  }
}

class VisMap extends React.PureComponent {
  state = {
    countyData: {},
    dataLayer: "mobility.observed_sip_date",
    dayNumber: 0,
    selectedRegions: new Set(["Alameda, California", "Santa Clara, California"])
  }
  
  transformComplianceValues(dataObject) {
    return {
      ...dataObject,
      bts_1: VALUE_MAPPING.get(dataObject.bts_1),
      cia_1: VALUE_MAPPING.get(dataObject.cia_1),
      cia_2: VALUE_MAPPING.get(dataObject.cia_2),
      cia_3: VALUE_MAPPING.get(dataObject.cia_3),
      location_2: (dataObject.location_2 || "").replace(/\s+(County|Parish)$/, '')
    };
  }
  
  processComplianceResults = (results, file) => {
    // console.log("got results!", results, this);
    // this.setState({surveyData: results});
    var out = {};
    for (let entry of results.data) {
      entry = this.transformComplianceValues(entry);
      let state = entry.location_1;
      let county = entry.location_2;
      if (! state || ! county) { continue; }
      // console.log("setting data for", state, county);
      if (! out[state]) {
        out[state] = {};
      }
      if (! out[state][county]) {
        out[state][county] = [];
      }
      out[state][county].push(entry);
    }
    // console.log("decorating with compliance");
    this.setState(state => ({countyData: {...state.countyData, compliance: out}}));
    // this.decorateCounties(out);
  }
  
  componentDidMount() {
    Papa.parse('/data/anonymized_data_2020_04_24.csv', {
      download: true,
      header: true,
      // worker: true,
      // step: (results, parser) => console.log("parse step!"),
      complete: this.processComplianceResults
    });
    Papa.parse('https://raw.githubusercontent.com/CSSEGISandData/COVID-19/master/csse_covid_19_data/csse_covid_19_time_series/time_series_covid19_confirmed_US.csv', {
      download: true,
      complete: this.processCaseResults
    });
    // Papa.parse(window.location.href+'data/cmi-20200505.csv', {
    //   download: true,
    //   worker: true,
    //   step: (results, parser) => console.log("parse step!"),
    //   complete: this.processCuebiqResults
    // })  
    let maxDaysMobility = cuebiq.California.Alameda.cmi.length - 387;
    this.setState(state => ({dayNumber: Math.min(state.dayNumber || 10000, maxDaysMobility), countyData: {...state.countyData, mobility: cuebiq, maxDaysMobility}}));
  }
  
  componentDidUpdate() {
    console.log("switching to data layer", this.state.dataLayer);
    let [ns, k] = this.state.dataLayer.split('.');
    console.log(this.state.countyData[ns], k);
  }
  
  transformCaseResults(headerIndices, dataObject) {
    let cases = dataObject.slice(headerIndices.get('1/22/20')).map(Number) // first date in this dataset for now
    return {
      cases: cases,
      newCases: Math.zip(cases.slice(0, -1), cases.slice(1)).map(([p, c]) => c-p),
      state: dataObject[headerIndices.get('Province_State')],
      county: dataObject[headerIndices.get('Admin2')]
    }
  }
  
  processCaseResults = (results, file) => {
    // console.log(results.data);
    var out = {};
    let header = results.data[0];
    let headerIndices = new window.Map(header.map((h, i) => [h, i]));
    let data = results.data.slice(1);
    let maxCases = 0;
    let maxNewCases = 0;
    let maxDays = 0;
    for (let entry of data) {
      entry = this.transformCaseResults(headerIndices, entry);
      let state = entry.state;
      let county = entry.county;
      if (! state || ! county) { continue; }
      if (! out[state]) {
        out[state] = {};
      }
      if (out[state][county]) {
        console.log("weird, multiple case data for county", state, county);
      }
      if (county === "New York") {
        console.log("new cases in NYC", entry.newCases);
      }
      out[state][county] = entry;
      maxCases = Math.max(maxCases, entry.cases[entry.cases.length-1]);
      maxNewCases = Math.max(maxNewCases, entry.newCases.reduce((a, b) => Math.max(a, b)));
      maxDays = Math.max(maxDays, entry.cases.length-1);
    }
    console.log("got case data");
    this.setState(state => ({dayNumber: Math.min(state.dayNumber || 10000, maxDays), countyData: {...state.countyData, cases: out, maxCases, maxDays, maxNewCases}}));
    // this.decorateCounties(out);
  }
  
  isFeatureSelected = (regionData) => { 
    return this.state.selectedRegions.has(`${regionData.name}, ${regionData.state}`);
  }
  setSelectedRegion = (regionData) => { 
    console.log("set region", regionData);
    const k = `${regionData.name}, ${regionData.state}`;
    if (k) {
      this.setState(state => {
        const next = new Set(state.selectedRegions);
        if (next.has(k)) {
          next.delete(k)
        } else {
          next.add(k);
        }
        return {selectedRegions: next};
      })
    }
  }
  
  onFeatureMouseOver = ({ layer }) => {
    console.log("entering", layer.feature.properties);
    const isSelected = this.isFeatureSelected(layer.feature.properties);
    layer.openTooltip();
    layer.setStyle({
      color: '#ffffff',
      weight: isSelected ? 3 : 2,
      opacity: 1,
    });
  }

  onFeatureMouseOut = ({ layer }) => {
    console.log("leaving", layer.feature.properties);
    const isSelected = this.isFeatureSelected(layer.feature.properties);
    // layer.closeTooltip();
    layer.setStyle({
      ...BASE_FEATURE_STYLES,
      weight: isSelected ? 3 : 1,
      opacity: isSelected ? 1 : 0.25,
    });
  }

  onFeatureClick = ({ layer }) => {
    const properties = layer?.feature?.properties;
    if (properties) {
      // Hack to fix bug where click event is not propagating from Leaflet (say, to close map dropdown menu via useClickOutside) when clicking neighboring state
      setTimeout(() => this.setSelectedRegion(properties));
      // ReactGA.event({
      //   category: 'Map',
      //   action: 'County Click',
      //   label: `${properties.regionName}, ${properties.state}`,
      // });
    }
  }
  
  geoJsonStyleForCounty = feature => {
    const isSelected = this.isFeatureSelected(feature.properties);
    let {properties: {name, state}} = feature;
    let [ns, k] = this.state.dataLayer.split('.');

    let data = this.state.countyData[ns]?.[state]?.[name];
    if (! data) {
      return INVISIBLE_FEATURE_STYLES;
    }
    
    let {minR, maxR, steps} = DATALAYER_LEGENDS.get(this.state.dataLayer);

    let r = minR;
    let fillColor;
    
    let avg = l => {
      l = l.filter(v => v !== undefined);
      if (l.length === 0) {
        return 0;
      }
      return l.reduce((p, c) => p+c,0)/l.length;
    }

    if (ns === 'compliance') {
      if (data) {
        r += avg(data.map(d => d[k]))*(maxR-minR)/steps;
      } else {
        return INVISIBLE_FEATURE_STYLES;
      }
    } else if (ns === "cases") {
      let i = this.state.dayNumber;
      if (k === "counts") {
        let counts = data.cases[i];
        r += (Math.log(counts)/Math.log(this.state.countyData.maxCases))*(maxR-minR)
      } else if (k === "new") {
        let now = avg(data.newCases.slice(i-7, i));
        r += (Math.log(now < 1 ? 1 : now)/Math.log(this.state.countyData.maxNewCases))*(maxR-minR)
      } else if (k === "growth") {
        let newCases = data.newCases;
        let now = avg(newCases.slice(i-7, i));
        let then = avg(newCases.slice(i-14, i-7));
        if (name === "Santa Clara") {
          console.log("Santa Clara", now, then);
        }
        r = Math.min(Math.max(0, (minR + maxR) / 2 + (now-then) / 10 * (maxR-minR)), 255);
      }
    } else if (ns === "mobility") {
      if (k === 'observed_sip_date') {
        let cmi = data.cmi.slice(386); // start at 1-22-2020
        let averageThroughMarch1 = avg(cmi.slice(0, 29+9));
        let sevenDayAverage = cmi.slice(3,cmi.length-4).map((_, i) => avg(cmi.slice(i,i+7)));
        let lowest7DayAverage = sevenDayAverage.reduce((imin, x, i, arr) => x < arr[imin] ? i : imin, 0);
        // let mediansByDay = Array(7).fill(0).map((_, d) => {
        //   let values = Array(6).fill(0).map((_, weekNo) => data.cmi[391+d+weekNo*7]);
        //   values.sort();
        //   return (values[2] + values[3])/2 || 0;
        // });
        // let lowest7DayMedian = Array(steps-7).fill(0).map(
        //   (_, i, arr) =>
        //     i > 0 ?
        //       arr[i-1]-data.cmi[391+i]/7+data.cmi[391+7*i]/7 :
        //       data.cmi.slice(391-7,391).reduce((p,c) => p+c/7, 0)
        // ).sort()[0];
        // let firstCheck = 391+6+6*7;
        // let maxIndex = data.cmi.reduce((iMax, x, i, arr) => i > 386 && x > arr[iMax] ? i : iMax, 0);
        // let minIndex = data.cmi.reduce((iMax, x, i, arr) => x !== null && i > 386+39 && x < arr[iMax] ? i : iMax, 0);
        // console.log("max,min", maxIndex, minIndex, "->", data.cmi[maxIndex], data.cmi[minIndex]);
        // let halfwayIndex = data.cmi.findIndex((x, i) => i > firstCheck && x < (mediansByDay[(i-391)%7] + lowest7DayMedian) * (1-.3));
        let shiftIndex = sevenDayAverage.findIndex((x, i) => i > 29+9-3 && x < (averageThroughMarch1 + sevenDayAverage[lowest7DayAverage]) * 0.5)
        let daysSinceStart = shiftIndex - (29+9); // since March 1 now
        console.log(name, state, "observed SIP on day", daysSinceStart, "as", averageThroughMarch1, "->", sevenDayAverage[lowest7DayAverage], "(@", lowest7DayAverage, "):", shiftIndex, "=", daysSinceStart);
        fillColor = `hsl(${minR+(maxR-minR)*daysSinceStart/steps}, 70%, 70%)`;
      } else {
        let i = Number(this.state.dayNumber) + 386 // difference between 1-1-2019 and 1-22-2020, the start days of our data sets
        let v = data[k][i];
        if (k === 'l1m' || k === 'l10m') {
          v += data.sip[i];
        }
        if (k === 'l10m') {
          v += data.l1m[i];
        }
        let range = (k === 'cmi' ? 5 : 1)
        r += (v / range) * (maxR-minR);
        // console.log("drawing mobility data", v, "for", name, state, "on day", i);
      }
    }

    return {
      ...BASE_FEATURE_STYLES,
      color: "white",
      weight: isSelected ? 3 : 1,
      fillOpacity: r < 0 ? 0 : 1,
      opacity: isSelected ? 1 : 0.25,
      fillColor: fillColor || `rgb(${r}, 200, 150)`
    };
  }
  
  extractData(ns, k, county, state, dayNumber) {
    let data = this.state.countyData[ns]?.[state]?.[county];
    let avg = l => {
      l = l.filter(v => v !== undefined);
      if (l.length === 0) {
        return 0;
      }
      return l.reduce((p, c) => p+c,0)/l.length;
    }
    
    if (ns === "mobility") {
      if (k === 'observed_sip_date') {
        k = 'cmi';
      }
      let i = Number(dayNumber) + 386 // difference between 1-1-2019 and 1-22-2020, the start days of our data sets
      let v = data[k][i];
      if (k === 'l1m' || k === 'l10m') {
        v += data.sip[i];
      }
      if (k === 'l10m') {
        v += data.l1m[i];
      }
      let range = (k === 'cmi' ? 5 : 1)
      return v / range;
    }
    if (ns === "cases") {
      if (k === "growth") {
        let i = dayNumber;
        if (i <= 7) return;
        let newCases = data.newCases;
        let now = avg(newCases.slice(i-7, i));
        let then = avg(newCases.slice(i-14, i-7));
        return now/then;
      }
    }
  }
  
  renderPlot() {
    const daysSinceStart = differenceInCalendarDays(new Date(), new Date(2020, 0, 22));
    const series = Array(daysSinceStart).fill(0).map((_, i) => i);
    const dates = series.map(d => format(addDays(START_DATE, d), 'MMM d'));
    const weekends = series.filter(d => isSaturday(addDays(START_DATE, d)));
    // const position = [this.state.lat, this.state.lng];
    let dataEntries = [];
    for (let region of this.state.selectedRegions) {
      let [ns, k] = this.state.dataLayer.split('.');
      let [county, state] = region.split(',', 2).map(s => s.trim());
      let data = this.state.countyData[ns]?.[state]?.[county];
      if (data) {
        let values = series.map(d => this.extractData(ns, k, county, state, d));
        console.log("drawing, for", region, values);
        dataEntries.push({
          type: 'scatter',
          x: dates.slice(0, dates.length-7),
          y: values.slice(3, values.length-4).map((v, i) => values.slice(i, i+7).reduce((p,c)=>p+c/7,0)),
          name: region          
        })
        // plots.push(<Plot
        //   data={[{
        //   }]}
        //   layout={ {width: 500, height: 300, title: region} }
        //   config={ {displayModeBar: false, fillFrame: true, scrollZoom: false} }
        // />);
      }
    }
    let layout = {width: 800, height: 350};
    if (weekends.length > 0) {
      layout.shapes = weekends.reduce((p, c, i) => {
        if (p.length == 0 || p[p.length-1].x1 < c) {
          p.push({
            type: 'rect',
            xref: 'x',
            yref: 'paper',
            x0: c,
            y0: 0,
            x1: c+1,
            y1: 1,
            fillcolor: '#d3d3d3',
            opacity: 0.3,
            line: {width: 0}
          })
        } else {
          p[p.length-1].x1 = c+1;
        }
        return p;
      }, []).map(d => ({
        ...d, 
        x0: format(addDays(START_DATE, d.x0), 'MMM d'),
        x1: format(addDays(START_DATE, d.x1), 'MMM d')
      }));
      console.log("using layout shapes", layout.shapes);
    }
    if (dataEntries.length > 0) {
      return <Plot
          data={dataEntries}
          config={ {displayModeBar: false, fillFrame: true, scrollZoom: false} }
          layout={layout}
        />
    }    
  }
  
  render() {
    let plot = this.renderPlot();
    return (
      <div className="map-container">
        <Map bounds={BOUNDS_US} zoom={4} renderer={CANVAS}>
          <TileLayer
            attribution={ATTRIBUTION}
            url={TILES_URL}
            />
          <GeoJSON
            data={COUNTIES_GEOJSON}
            style={this.geoJsonStyleForCounty}
            onMouseOver={this.onFeatureMouseOver}
            onMouseOut={this.onFeatureMouseOut}
            onClick={this.onFeatureClick}
          />
          {/* <Marker position={position}>
            <Popup>
              A pretty CSS3 popup.
            </Popup>
          </Marker> */}
        </Map>
        <VisMapMenu 
          dataLayer={this.state.dataLayer}
          countyData={this.state.countyData}
          dayNumber={this.state.dayNumber}
          setDayNumber={n => this.setState({dayNumber: n})}
          setLayer={l => this.setState({dataLayer: l})}
        />
        <div className="plot-div">
          {plot}
        </div>
      </div>
    )
  }
}