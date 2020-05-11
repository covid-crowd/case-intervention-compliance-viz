import React from 'react';
import logo from './logo.svg';
import './App.css';
import L from 'leaflet';
import { Map, TileLayer, Marker, Popup, GeoJSON } from 'react-leaflet'
import Papa from 'papaparse';
import {addDays, format} from 'date-fns';

import * as topojson from 'topojson-client';

import counties from './data/counties-10m.json';

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
const MAX_BOUNDS_US = [
  [55.4, -54.96],
  [55.4, -137.51],
  [17.4, -54.96],
  [17.4, -137.51],
];


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
  ['compliance.bts_1', "% others distancing, observed"]
]);

const DATALAYER_LEGENDS = new window.Map([
  ['cases.counts', {min: "0", max: c => c.maxCases+" cases", steps: 4, minR: 100, maxR: 250}],
  ['cases.new', {min: "0", max: c => c.maxNewCases+" cases/day", steps: 4, minR: 100, maxR: 250}],
  ['cases.growth', {min: "dropping fast", max: "rising fast", steps: 4, minR: 100, maxR: 250}],
  ['compliance.cia_1', {min: "< 1 day", max: "> 2 weeks", steps: 5, minR: 150, maxR: 250}],
  ['compliance.cia_2', {min: "< 1 day", max: "> 2 weeks", steps: 5, minR: 150, maxR: 250}],
  ['compliance.cia_3', {min: "< 1 day", max: "> 2 weeks", steps: 5, minR: 150, maxR: 250}],
  ['compliance.bts_1', {min: "0%", max: "100%", steps: 4, minR: 100, maxR: 250}]
]);

// const DATALAYER_CONTROLS = new window.Map([
//   ['cases.counts', [{type: "slider", }]]
// ])

class VisMapLegend extends React.PureComponent {
  render() {
    let f2s = f => typeof(f) === 'function' ? f(this.props.countyData) : f;
    let {min, max, steps, minR, maxR, width} = this.props;
    let height = 10;
    let out = [];
    for (var i = 0; i < f2s(steps); i++) {
      out.push(<div className="segment" key={i} style={{background: `rgb(${minR+(maxR-minR)*i/steps}, 200, 150)`, display: "inline-block", width: width/steps, height: height}}> </div>)
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
    let {max, width, dayNumber} = this.props;
    let height = 10;
    let startDate = new Date(2020, 0, 22);
    let endDate = addDays(startDate, this.props.countyData.maxDays || 0);
    return <div className="date-slider" style={{width: width, height: height + 20}}>
        <span className="display" style={{position: "absolute", top: 0, width: "100%", "text-align": "center" }}>{format(addDays(startDate, dayNumber), 'M/d/yyyy')}</span>
        <input type="range" style={{width: width}} min="0" max={this.props.countyData.maxDays || 0} step="1" value={dayNumber} onChange={event => this.props.setDayNumber(event.target.value)} />
        <span className="leftIndex" style={{position: "absolute", top: height+10, left: 0}}>{format(startDate, 'M/d/yyyy')}</span>
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
          {this.props.dataLayer.startsWith('cases.') && <VisMapDateSlider
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
    dataLayer: "cases.growth",
    dayNumber: 0
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
    console.log(results.data);
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
      if (county == "New York") {
        console.log("new cases in NYC", entry.newCases);
      }
      out[state][county] = entry;
      maxCases = Math.max(maxCases, entry.cases[entry.cases.length-1]);
      maxNewCases = Math.max(maxNewCases, entry.newCases.reduce((a, b) => Math.max(a, b)));
      maxDays = Math.max(maxDays, entry.cases.length-1);
    }
    // console.log("decorating with cases");
    this.setState(state => ({dayNumber: maxDays, countyData: {...state.countyData, cases: out, maxCases, maxDays, maxNewCases}}));
    // this.decorateCounties(out);
  }
  
  geoJsonStyleForCounty = feature => {
    let {id, properties: {name, state}} = feature;
    let [ns, k] = this.state.dataLayer.split('.');

    let data = this.state.countyData[ns]?.[state]?.[name];
    if (! data) {
      return INVISIBLE_FEATURE_STYLES;
    }
    
    let {minR, maxR, steps} = DATALAYER_LEGENDS.get(this.state.dataLayer);

    let r = minR;
    
    let avg = l => {
      l = l.filter(v => v !== undefined);
      if (l.length === 0) {
        return 0;
      }
      return l.reduce((p, c) => p+c,0)/l.length;
    }

    if (ns == 'compliance') {
      if (data) {
        r += avg(data.map(d => d[k]))*(maxR-minR)/steps;
      } else {
        return INVISIBLE_FEATURE_STYLES;
      }
    } else if (ns == "cases") {
      let i = this.state.dayNumber;
      if (k == "counts") {
        let counts = data.cases[i];
        r += (Math.log(counts)/Math.log(this.state.countyData.maxCases))*(maxR-minR)
      } else if (k == "new") {
        let now = avg(data.newCases.slice(i-7, i));
        r += (Math.log(now < 1 ? 1 : now)/Math.log(this.state.countyData.maxNewCases))*(maxR-minR)
      } else if (k == "growth") {
        let newCases = data.newCases;
        let now = avg(newCases.slice(i-4, i));
        let then = avg(newCases.slice(i-8, i-4));
        if (name == "Santa Clara") {
          console.log("Santa Clara", now, then);
        }
        r = Math.min(Math.max(0, (minR + maxR) / 2 + (now-then) / 10 * (maxR-minR)), 255);
      }
    }

    return {
      ...BASE_FEATURE_STYLES,
      weight: 1,
      fillOpacity: r < 0 ? 0 : 1,
      opacity: 0.25,
      fillColor: `rgb(${r}, 200, 150)`
    };
  }
  
  render() {
    const position = [this.state.lat, this.state.lng];
    
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
          />}
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
      </div>
    )
  }
}