import SwiftUI
import MapKit

struct MapScreen: View {
    @Environment(HotelStore.self) private var store
    @State private var position: MapCameraPosition = .automatic
    @State private var selectedID: Int?
    @State private var path: [Hotel] = []
    @State private var showFilters = false

    /// The same stays as the Explore list: wilaya, search text and filters all apply.
    private var pins: [Hotel] {
        store.results.filter { $0.coordinate != nil }
    }

    private var selected: Hotel? { selectedID.flatMap { store.hotel($0) } }

    var body: some View {
        @Bindable var store = store
        let active = store.filters.activeCount
        NavigationStack(path: $path) {
            Map(position: $position) {
                ForEach(pins) { hotel in
                    Annotation(hotel.name, coordinate: hotel.coordinate!, anchor: .bottom) {
                        RatingPin(hotel: hotel, isSelected: hotel.id == selectedID)
                            .onTapGesture {
                                withAnimation(.snappy) { selectedID = hotel.id }
                            }
                    }
                    .annotationTitles(.hidden)
                }
            }
            .mapStyle(.standard(pointsOfInterest: .excludingAll))
            .mapControls {
                MapCompass()
                MapScaleView()
                MapPitchToggle()
            }
            .safeAreaInset(edge: .top) {
                HStack(spacing: 8) {
                    WilayaMenu(region: $store.region) {
                        store.filters.towns = []
                        store.persistSearch()
                        selectedID = nil
                        withAnimation { position = .automatic }
                    }
                    .padding(.horizontal, 14)
                    .frame(height: 40)
                    .background(.regularMaterial, in: Capsule())

                    Button { showFilters = true } label: {
                        HStack(spacing: 5) {
                            Image(systemName: "line.3.horizontal.decrease")
                            Text(active > 0 ? LF("Filters · %d", active) : L("Filters"))
                        }
                        .font(.app(.subheadline, .semibold))
                        .padding(.horizontal, 14)
                        .frame(height: 40)
                        .foregroundStyle(active > 0 ? Color.accentColor : Color.primary)
                        .background(.regularMaterial, in: Capsule())
                    }
                    .buttonStyle(.plain)

                    Text("\(pins.count) on map")
                        .font(.app(.caption, .semibold))
                        .monospacedDigit()
                        .padding(.horizontal, 10)
                        .frame(height: 28)
                        .background(.regularMaterial, in: Capsule())
                }
                .padding(.top, 4)
            }
            .safeAreaInset(edge: .bottom) {
                Group {
                    if let hotel = selected {
                        MapPreviewCard(hotel: hotel,
                                       open: { path.append(hotel) },
                                       close: { withAnimation(.snappy) { selectedID = nil } })
                    } else {
                        Label("Tap a pin to preview a stay. Green pins are rated 4.5 or higher.", systemImage: "hand.tap")
                            .font(.app(.footnote, .medium))
                            .foregroundStyle(.secondary)
                            .padding(.horizontal, 14).padding(.vertical, 10)
                            .background(.regularMaterial, in: Capsule())
                    }
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 8)
            }
            .sheet(isPresented: $showFilters, onDismiss: {
                selectedID = nil
                withAnimation { position = .automatic }
            }) { FilterSheet() }
            .navigationTitle("Map")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        withAnimation { position = .automatic }
                    } label: {
                        Label("Show all", systemImage: "arrow.up.left.and.arrow.down.right")
                    }
                }
            }
            .navigationDestination(for: Hotel.self) { HotelDetailView(hotel: $0) }
        }
    }
}

struct RatingPin: View {
    let hotel: Hotel
    let isSelected: Bool

    var body: some View {
        Group {
            if let rating = hotel.rating {
                Text(rating, format: .number.precision(.fractionLength(1)))
                    .font(.app(.caption, .bold))
                    .monospacedDigit()
                    .foregroundStyle(isSelected || rating >= 4.5 ? Color.white : Color.black)
                    .padding(.horizontal, 7)
                    .padding(.vertical, 4)
                    .background(isSelected ? Color.accentColor : (rating >= 4.5 ? Color.pinGood : Color.white), in: Capsule())
                    .overlay(Capsule().strokeBorder(.black.opacity(0.12)))
            } else {
                Circle()
                    .fill(isSelected ? Color.accentColor : Color.gray)
                    .frame(width: 13, height: 13)
                    .overlay(Circle().stroke(.white, lineWidth: 2))
            }
        }
        .shadow(color: .black.opacity(0.25), radius: 2, y: 1)
        .scaleEffect(isSelected ? 1.25 : 1)
        .accessibilityLabel(hotel.name)
        .accessibilityAddTraits(.isButton)
    }
}

struct MapPreviewCard: View {
    let hotel: Hotel
    let open: () -> Void
    let close: () -> Void

    var body: some View {
        ZStack(alignment: .topTrailing) {
            Button(action: open) {
                HStack(spacing: 12) {
                    PhotoBox(path: hotel.photos.first, placeholderText: "", kind: hotel.type, size: .thumb)
                        .frame(width: 96, height: 84)
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    VStack(alignment: .leading, spacing: 4) {
                        Text(hotel.name).font(.app(.headline)).lineLimit(1)
                        Text(hotel.metaLine).font(.app(.caption)).foregroundStyle(.secondary).lineLimit(1)
                        RatingRow(hotel: hotel)
                        PriceLabel(hotel: hotel)
                    }
                    Spacer(minLength: 0)
                    Image(systemName: "chevron.forward").font(.app(.subheadline, .semibold)).foregroundStyle(.tertiary)
                }
                .padding(10)
                .padding(.trailing, 4)
                .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
            }
            .buttonStyle(.plain)

            Button(action: close) {
                Image(systemName: "xmark")
                    .font(.app(.caption, .bold))
                    .frame(width: 26, height: 26)
                    .background(.thinMaterial, in: Circle())
            }
            .buttonStyle(.plain)
            .padding(6)
            .accessibilityLabel("Close preview")
        }
    }
}

struct SavedView: View {
    @Environment(HotelStore.self) private var store

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVStack(spacing: 16) {
                    if store.savedHotels.isEmpty {
                        ContentUnavailableView {
                            Label("No saved stays yet", systemImage: "heart")
                        } description: {
                            Text("Tap the heart on any stay to keep it here.")
                        }
                        .padding(.top, 80)
                    }
                    ForEach(store.savedHotels) { hotel in
                        HotelCard(hotel: hotel).padding(.horizontal, 16)
                    }
                }
                .padding(.vertical, 12)
            }
            .background(Color.canvas)
            .navigationTitle("Saved")
            .navigationDestination(for: Hotel.self) { HotelDetailView(hotel: $0) }
        }
    }
}
