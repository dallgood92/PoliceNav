// Mile markers are not returned by Expo reverse geocoding. Keep this lookup
// separate from live GPS so a network/data-provider delay never blocks the UI.
//
// Texas implementation target:
//   TxDOT Enterprise Linear Referencing Service / Reference Marker dataset
//
// The provider should return a result shaped like:
//   { route: 'I-35W', marker: '79', offsetMiles: 0.3, source: 'TxDOT' }
// or null when the device is not on a supported highway.
export async function lookupMileMarker(_latitude, _longitude) {
  return null;
}
