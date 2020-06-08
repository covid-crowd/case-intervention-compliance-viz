let fs = require('fs');
let Papa = require('papaparse');

let {parse, differenceInCalendarDays} = require('date-fns');

Papa.parse(fs.createReadStream('src/data/cmi-20200505.csv'), {
  encoding: 'utf-8',
  complete: processCuebiqResults
})

const reference_date = parse('2019-01-01', 'yyyy-MM-dd', new Date());

function rounder(n) {
  let f = 10**n;
  return v => Math.round(v*f)/f;
}

const round4 = rounder(4);

function transformCuebiqResults(headerIndices, dataObject) {
  var date = parse(dataObject[headerIndices.get('ref_dt')], 'yyyy-MM-dd', new Date());
  var dayNo = differenceInCalendarDays(date, reference_date);

  return {
    state: dataObject[headerIndices.get('state_name')],
    county: dataObject[headerIndices.get('county_name')],
    dayNo: dayNo,
    date: dataObject[headerIndices.get('ref_dt')],
    cmi: round4(dataObject[headerIndices.get('cmi')]),
    sheltered_in_place: round4(dataObject[headerIndices.get('sheltered_in_place')]),
    less_1_mile: round4(dataObject[headerIndices.get('less_1_mile')]),
    less_10_mile: round4(dataObject[headerIndices.get('less_10_mile')]),
  }
}


function processCuebiqResults(results, file) {
  console.log("got results! total count:", results.data.length);
  var out = {};
  let header = results.data[0];
  let headerIndices = new Map(header.map((h, i) => [h, i]));
  let data = results.data.slice(1);
  let lists = [];
  let i = 0;
  for (let entry of data) {
    if (i++ > 0 && i % 100000 === 0) { console.log(i/100000);}
    entry = transformCuebiqResults(headerIndices, entry);
    let state = entry.state;
    let county = entry.county;
    if (! state || ! county) { continue; }
    if (! out[state]) {
      out[state] = {};
    }
    if (! out[state][county]) {
      out[state][county] = {
        county, state, cmi: [], sip: [], l1m: [], l10m: []
      };
    }
    let dayNo = entry.dayNo;
    let agg = out[state][county];
    agg.cmi[dayNo] = entry.cmi;
    agg.sip[dayNo] = entry.sheltered_in_place;
    agg.l1m[dayNo] = entry.less_1_mile;
    agg.l10m[dayNo] = entry.less_10_mile;
  }
  console.log("writing data...");
  let d = out["New York"]["New York"]
  console.log(d.cmi[100], d.cmi.length);
  fs.writeFileSync('public/data/cmi-20200505.json', JSON.stringify(out));
}
