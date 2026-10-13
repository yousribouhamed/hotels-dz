import SwiftUI
import MapKit
import UIKit

/// One long, calm scroll in the Airbnb style: photos, then the essentials, then
/// sections that only appear when Google actually has something to show.
struct HotelDetailView: View {
    @Environment(HotelStore.self) private var store
    @Environment(ModerationStore.self) private var moderation
    @Environment(CommunityStore.self) private var community
    @Environment(\.openURL) private var openURL
    let hotel: Hotel

    @State private var page = 0
    @State private var showAllAmenities = false
    @State private var showAllReviews = false
    @State private var showWriteReview = false
    @State private var showSignIn = false
    @State private var copiedNote: String?
    /// Once the photos scroll away, show a solid bar with the name behind the buttons.
    @State private var pastGallery = false

    var body: some View {
        let traits = store.traits(hotel)
        ScrollViewReader { proxy in
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    gallery
                        .onGeometryChange(for: Bool.self) { $0.frame(in: .scrollView).minY < -290 } action: { past in
                            withAnimation(.easeInOut(duration: 0.2)) { pastGallery = past }
                        }
                    VStack(alignment: .leading, spacing: 24) {
                        header(traits)
                        if hotel.rating != nil {
                            ratingStrip { withAnimation(.snappy) { proxy.scrollTo("reviews", anchor: .top) } }
                        }
                        if hotel.closed {
                            Label("This stay is marked as closed. Call before you travel.", systemImage: "exclamationmark.triangle.fill")
                                .font(.app(.subheadline, .semibold))
                                .foregroundStyle(Color.heart)
                        }
                        if !hotel.rateRows.isEmpty { section("Prices") { prices } }
                        if !hotel.desc.isEmpty { section("About this place") { about } }
                        if hotel.am.contains(where: \.y) { section("What this place offers") { amenities } }
                        if hotel.rating != nil || community.isAvailable {
                            // Invisible anchor a bit above the section so the jump clears the top bar.
                            Color.clear.frame(height: 0).padding(.top, -110).id("reviews")
                            section("Reviews") { reviews }
                        }
                        section("Where you’ll be") { location(traits) }
                        if !hotel.phone.isEmpty || !hotel.email.isEmpty || hotel.websiteURL != nil {
                            section("Contact") { contact }
                        }
                        nearby
                    }
                    .padding(.horizontal, 20)
                    .padding(.top, 20)
                    .padding(.bottom, 24)
                }
            }
        }
        .ignoresSafeArea(edges: .top)
        .background(Color.canvas)
        .navigationTitle(pastGallery ? hotel.name : "")
        .navigationBarTitleDisplayMode(.inline)
        .overlay(alignment: .top) {
            // Solid band behind the back/share/save buttons once the photos have scrolled away.
            // Zero height: the background fills exactly the status bar and navigation bar area.
            Color.clear
                .frame(height: 0)
                .frame(maxWidth: .infinity)
                .background(Color.canvas.ignoresSafeArea(edges: .top))
                .overlay(alignment: .bottom) { Divider().overlay(Color.line) }
                .opacity(pastGallery ? 1 : 0)
                .allowsHitTesting(false)
        }
        .toolbar(.hidden, for: .tabBar)
        .toolbar {
            ToolbarItemGroup(placement: .topBarTrailing) {
                if let url = hotel.googleMapsURL {
                    ShareLink(item: url, subject: Text(hotel.name)) {
                        Image(systemName: "square.and.arrow.up")
                    }
                }
                Button {
                    withAnimation(.snappy) { store.toggleSaved(hotel) }
                } label: {
                    Image(systemName: store.isSaved(hotel) ? "heart.fill" : "heart")
                        .foregroundStyle(store.isSaved(hotel) ? Color.heart : Color.primary)
                }
                .accessibilityLabel(store.isSaved(hotel) ? "Remove from saved" : "Save")
            }
        }
        .safeAreaInset(edge: .bottom) { bottomBar }
        .overlay(alignment: .bottom) {
            if let copiedNote {
                Label(L(copiedNote), systemImage: "checkmark.circle.fill")
                    .font(.app(.subheadline, .semibold))
                    .padding(.horizontal, 14).padding(.vertical, 10)
                    .background(.regularMaterial, in: Capsule())
                    .padding(.bottom, 100)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
        .sheet(isPresented: $showAllAmenities) { allAmenities }
        .sheet(isPresented: $showAllReviews) { allReviews }
        .sheet(isPresented: $showWriteReview) {
            WriteReviewSheet(hotel: hotel) { note in toast(note) }
        }
        .sheet(isPresented: $showSignIn) {
            SignInSheet { Task { await community.load(hotel.id); showWriteReview = true } }
        }
        .task(id: hotel.id) { await community.load(hotel.id) }
    }

    // MARK: Gallery

    private var gallery: some View {
        ZStack(alignment: .bottom) {
            if hotel.photos.isEmpty {
                PhotoBox(path: nil, placeholderText: "No photos yet", kind: hotel.type)
            } else {
                TabView(selection: $page) {
                    ForEach(Array(hotel.photos.enumerated()), id: \.offset) { i, path in
                        PhotoBox(path: path).tag(i)
                    }
                }
                .tabViewStyle(.page(indexDisplayMode: .never))

                if hotel.photos.count > 1 {
                    LinearGradient(colors: [.clear, .black.opacity(0.3)], startPoint: .top, endPoint: .bottom)
                        .frame(height: 60)
                        .allowsHitTesting(false)
                    PageDots(count: hotel.photos.count, current: page)
                        .padding(.bottom, 14)
                        .allowsHitTesting(false)
                    Text("\(page + 1) / \(hotel.photos.count)")
                        .font(.app(.caption, .semibold))
                        .monospacedDigit()
                        .foregroundStyle(.white)
                        .padding(.horizontal, 9).padding(.vertical, 4)
                        .background(.black.opacity(0.5), in: Capsule())
                        .frame(maxWidth: .infinity, alignment: .trailing)
                        .padding(14)
                }
            }
        }
        .frame(height: 340)
        .clipped()
    }

    // MARK: Header

    private func header(_ traits: StayTraits) -> some View {
        HStack(alignment: .top, spacing: 12) {
            titleBlock(traits)
            Spacer(minLength: 0)
            directionsButton
        }
    }

    private func titleBlock(_ traits: StayTraits) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 6) {
                Text(L(hotel.type))
                if let s = hotel.starsText { Text(s).foregroundStyle(Color.star) }
            }
            .font(.app(.subheadline, .semibold))
            .foregroundStyle(.secondary)

            Text(hotel.name)
                .font(.app(.title2, .bold))
                .fixedSize(horizontal: false, vertical: true)

            // One text so it wraps as a sentence next to the Directions button.
            (Text(hotel.city == hotel.regionName ? L(hotel.city) : "\(hotel.city), \(L(hotel.regionName))")
             + Text(traits.km.flatMap { km in traits.centreLabel.map { " " + LF("· %@ from %@", Fmt.distance(km), $0) } } ?? ""))
            .font(.app(.subheadline))
            .foregroundStyle(.secondary)
            .lineLimit(2)
        }
    }

    /// Airbnb-style strip: score · label · review count. Tapping jumps to the reviews.
    private func ratingStrip(onTap: @escaping () -> Void) -> some View {
        Button(action: onTap) {
            HStack(spacing: 0) {
                stripCell {
                    if hotel.isGuestFavourite {
                        // Top-rated: just the score sits between small gold laurels, stars below.
                        Laurels(height: 24) {
                            Text(hotel.rating ?? 0, format: .number.precision(.fractionLength(1)))
                                .font(.app(.title3, .bold))
                        }
                        starsRow(Int((hotel.rating ?? 0).rounded()))
                    } else {
                        Text(hotel.rating ?? 0, format: .number.precision(.fractionLength(1)))
                            .font(.app(.title3, .bold))
                        starsRow(Int((hotel.rating ?? 0).rounded()))
                    }
                }
                Divider().frame(height: 34)
                if hotel.isGuestFavourite {
                    stripCell {
                        Text("Guest favourite")
                            .font(.app(.headline))
                            .multilineTextAlignment(.center)
                            .frame(maxWidth: 90)
                    }
                } else {
                    stripCell {
                        Text(hotel.ratingLabel).font(.app(.headline))
                        Text("Guest rating").font(.app(.caption)).foregroundStyle(.secondary)
                    }
                }
                Divider().frame(height: 34)
                stripCell {
                    Text("\(hotel.reviews)").font(.app(.title3, .bold)).monospacedDigit()
                    Text(hotel.reviews == 1 ? L("Review") : L("Reviews")).font(.app(.caption)).foregroundStyle(.secondary)
                }
            }
            .padding(.vertical, 12)
            .padding(.horizontal, 6)
            .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(Color.line))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(LF("Rated %@, %@, %d reviews. Show reviews", String(format: "%.1f", hotel.rating ?? 0), hotel.ratingLabel, hotel.reviews))
    }

    private func stripCell<C: View>(@ViewBuilder _ content: () -> C) -> some View {
        VStack(spacing: 2) { content() }.frame(maxWidth: .infinity)
    }

    private func starsRow(_ n: Int) -> some View {
        HStack(spacing: 1) {
            ForEach(0..<5, id: \.self) { i in
                Image(systemName: i < n ? "star.fill" : "star")
            }
        }
        .font(.system(size: 9))
        .foregroundStyle(Color.star)
    }

    /// Round Directions button at the top right of the title; opens Apple Maps or Google Maps.
    /// (Calling is the "Call to book" button at the bottom, so there's no Call card here.)
    @ViewBuilder private var directionsButton: some View {
        if hotel.appleMapsURL != nil || hotel.googleMapsURL != nil {
            Menu {
                if let url = hotel.appleMapsURL { Button("Apple Maps", systemImage: "map") { openURL(url) } }
                if let url = hotel.googleMapsURL { Button("Google Maps", systemImage: "globe") { openURL(url) } }
            } label: {
                VStack(spacing: 4) {
                    Image(systemName: "arrow.triangle.turn.up.right.diamond.fill")
                        .font(.system(size: 20, weight: .semibold))
                        .foregroundStyle(Color.onAccent)
                        .frame(width: 52, height: 52)
                        .background(Color.accentColor, in: Circle())
                    Text("Directions")
                        .font(.app(.caption2, .semibold))
                        .foregroundStyle(.secondary)
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel(L("Directions"))
        }
    }

    // MARK: Sections

    private func section<C: View>(_ title: String, @ViewBuilder content: () -> C) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            Divider().overlay(Color.line)
                .padding(.bottom, 6)
            SectionTitle(title)
            content()
        }
    }

    private var prices: some View {
        VStack(spacing: 0) {
            ForEach(Array(hotel.rateRows.enumerated()), id: \.offset) { i, row in
                HStack(alignment: .firstTextBaseline) {
                    Text(L(row.site)).lineLimit(1)
                    if i == 0 {
                        Text("Lowest")
                            .font(.app(.caption2, .bold))
                            .foregroundStyle(Color.good)
                            .padding(.horizontal, 6).padding(.vertical, 2)
                            .background(Color.brandSoft, in: Capsule())
                    }
                    Spacer()
                    Text(Money.dzd(row.dzd)).fontWeight(.semibold).monospacedDigit()
                }
                .padding(.vertical, 12)
                if i < hotel.rateRows.count - 1 { Divider().overlay(Color.line) }
            }
        }
    }

    private var about: some View {
        ExpandableText(text: hotel.desc)
    }

    private var amenities: some View {
        let available = hotel.am.filter(\.y)
        return VStack(alignment: .leading, spacing: 14) {
            // 3×3 tiles: icon on top, name below; the rest are under "Show all".
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 8), count: 3), spacing: 8) {
                ForEach(available.prefix(9), id: \.self) { a in
                    VStack(alignment: .leading, spacing: 8) {
                        Image(systemName: Self.amenitySymbol(a.n))
                            .font(.app(.title3))
                            .foregroundStyle(Color.accentColor)
                            .frame(height: 24)
                        Text(L(a.n))
                            .font(.app(.footnote, .medium))
                            .lineLimit(2, reservesSpace: true)   // every tile the same height
                            .multilineTextAlignment(.leading)
                    }
                    .frame(maxWidth: .infinity, alignment: .topLeading)
                    .padding(10)
                    .background(Color.surface, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                }
            }
            if hotel.am.count > 9 {
                Button("Show all \(hotel.am.count) amenities") { showAllAmenities = true }
                    .buttonStyle(.bordered)
                    .controlSize(.large)
                    .frame(maxWidth: .infinity)
                    .padding(.top, 4)
            }
        }
    }

    private var allAmenities: some View {
        NavigationStack {
            List {
                let yes = hotel.am.filter(\.y), no = hotel.am.filter { !$0.y }
                Section("Available") {
                    ForEach(yes, id: \.self) { a in
                        Label(L(a.n), systemImage: Self.amenitySymbol(a.n))
                    }
                }
                if !no.isEmpty {
                    Section("Not available") {
                        ForEach(no, id: \.self) { a in
                            Label(L(a.n), systemImage: Self.amenitySymbol(a.n))
                                .foregroundStyle(.secondary)
                                .strikethrough()
                        }
                    }
                }
            }
            .scrollContentBackground(.hidden)
            .background(Color.canvas)
            .navigationTitle("What this place offers")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { showAllAmenities = false }
                }
            }
        }
        .presentationDetents([.medium, .large])
        .tint(Color.accentColor)
    }

    static func amenitySymbol(_ name: String) -> String {
        let n = name.lowercased()
        let table: [(String, String)] = [
            ("wi-fi", "wifi"), ("parking", "parkingsign"), ("breakfast", "cup.and.saucer"),
            ("air con", "snowflake"), ("restaurant", "fork.knife"), ("bar", "wineglass"),
            ("pool", "figure.pool.swim"), ("shuttle", "airplane"), ("kid", "figure.2.and.child.holdinghands"),
            ("pets", "pawprint"), ("fitness", "dumbbell"), ("spa", "leaf"), ("hot tub", "bathtub"),
            ("laundry", "washer"), ("room service", "bell"), ("wheelchair", "figure.roll"),
            ("business", "briefcase"), ("smoking", "nosign"), ("beach", "beach.umbrella"), ("kitchen", "frying.pan")
        ]
        return table.first { n.contains($0.0) }?.1 ?? "checkmark.circle"
    }

    private var reviews: some View {
        let guests = community.reviews(for: hotel.id)
        let mine = community.mine(for: hotel.id)
        let visible = moderation.visibleReviews(hotel)
        let total = visible.count + guests.count + (mine == nil ? 0 : 1)
        return VStack(alignment: .leading, spacing: 18) {
            if hotel.rating == nil {
                if guests.isEmpty && mine == nil {
                    Text("No reviews yet").font(.app(.subheadline)).foregroundStyle(.secondary)
                } else {
                    guestSummary(guests + (mine.map { [$0] } ?? []))
                }
            } else if hotel.isGuestFavourite {
                // Top-rated stays: score between gold laurels on one side, star breakdown on the other.
                HStack(alignment: .center, spacing: 16) {
                    VStack(spacing: 4) {
                        Laurels(height: 52) {
                            Text(hotel.rating ?? 0, format: .number.precision(.fractionLength(1)))
                                .font(.appFixed(size: 40, weight: .bold, design: .rounded))
                                .monospacedDigit()
                        }
                        Text("Guest favourite")
                            .font(.app(.subheadline, .bold))
                            .multilineTextAlignment(.center)
                        Text(hotel.reviewCountText)
                            .font(.app(.caption))
                            .foregroundStyle(.secondary)
                    }
                    .fixedSize(horizontal: false, vertical: true)
                    .frame(maxWidth: 150)
                    distribution
                }
                .padding(.vertical, 6)
            } else {
                HStack(alignment: .center, spacing: 20) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(hotel.rating ?? 0, format: .number.precision(.fractionLength(1)))
                            .font(.appFixed(size: 44, weight: .bold, design: .rounded))
                            .monospacedDigit()
                        Text(hotel.reviewCountText).font(.app(.caption)).foregroundStyle(.secondary)
                    }
                    distribution
                }
            }
            if total > 0 {
                ScrollView(.horizontal, showsIndicators: false) {
                    LazyHStack(alignment: .top, spacing: 12) {
                        if let mine {
                            GuestReviewCard(hotel: hotel, review: mine, isMine: true, onEdit: writeReview, onNote: toast)
                        }
                        ForEach(guests.prefix(10)) { r in
                            GuestReviewCard(hotel: hotel, review: r, onNote: toast)
                        }
                        ForEach(visible.prefix(10), id: \.self) { r in reviewCard(r) }
                    }
                    .scrollTargetLayout()
                }
                .scrollTargetBehavior(.viewAligned)
                .padding(.horizontal, -20)
                .contentMargins(.horizontal, 20, for: .scrollContent)
            }
            VStack(spacing: 10) {
                if total > (mine == nil ? 0 : 1) + min(guests.count, 10) + min(visible.count, 10) {
                    Button(LF("Show all %d reviews", total)) { showAllReviews = true }
                        .buttonStyle(.bordered)
                        .controlSize(.large)
                        .frame(maxWidth: .infinity)
                }
                if community.isAvailable {
                    Button(action: writeReview) {
                        Label(mine == nil ? (total == 0 ? L("Be the first to review this place") : L("Write a review")) : L("Edit your review"),
                              systemImage: mine == nil ? "square.and.pencil" : "pencil")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered)
                    .controlSize(.large)
                }
            }
            .font(.app(.body, .semibold))
        }
    }

    /// Opens the review form, or sign-in first when nobody is signed in.
    private func writeReview() {
        if community.isSignedIn { showWriteReview = true } else { showSignIn = true }
    }

    /// For stays without collected reviews: the average of the guest reviews.
    private func guestSummary(_ list: [GuestReview]) -> some View {
        let average = Double(list.map(\.rating).reduce(0, +)) / Double(max(1, list.count))
        return HStack(alignment: .firstTextBaseline, spacing: 10) {
            Text(average, format: .number.precision(.fractionLength(1)))
                .font(.appFixed(size: 44, weight: .bold, design: .rounded))
                .monospacedDigit()
            Text(list.count == 1 ? L("1 review") : LF("%d reviews", list.count))
                .font(.app(.caption))
                .foregroundStyle(.secondary)
        }
    }

    /// Every collected review in a scrolling list, newest-relevant first.
    private var allReviews: some View {
        NavigationStack {
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 0) {
                    if let mine = community.mine(for: hotel.id) {
                        GuestReviewRow(hotel: hotel, review: mine, isMine: true, onEdit: { showAllReviews = false; writeReview() }, onNote: toast)
                        Divider().overlay(Color.line)
                    }
                    ForEach(community.reviews(for: hotel.id)) { r in
                        GuestReviewRow(hotel: hotel, review: r, onNote: toast)
                        Divider().overlay(Color.line)
                    }
                    ForEach(moderation.visibleReviews(hotel), id: \.self) { r in
                        VStack(alignment: .leading, spacing: 8) {
                            HStack(spacing: 6) {
                                starsRow(r.s ?? 0)
                                if let d = Fmt.day(r.d) {
                                    Text("· \(d)").font(.app(.caption)).foregroundStyle(.secondary)
                                }
                                Spacer()
                                ReviewActionsMenu(hotel: hotel, review: r) { note in toast(note) }
                            }
                            Text(r.t)
                                .font(.app(.subheadline))
                                .fixedSize(horizontal: false, vertical: true)
                        }
                        .padding(.vertical, 14)
                        Divider().overlay(Color.line)
                    }
                }
                .padding(.horizontal, 20)
            }
            .background(Color.canvas)
            .navigationTitle(LF("%d reviews", moderation.visibleReviews(hotel).count + community.reviews(for: hotel.id).count + (community.mine(for: hotel.id) == nil ? 0 : 1)))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { showAllReviews = false }
                }
            }
        }
        .presentationDetents([.large])
        .tint(Color.accentColor)
        .appLayoutDirection()
    }

    private func reviewCard(_ r: Hotel.Review) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                starsRow(r.s ?? 0)
                if let d = Fmt.day(r.d) {
                    Text("· \(d)").font(.app(.caption)).foregroundStyle(.secondary)
                }
                Spacer(minLength: 0)
                ReviewActionsMenu(hotel: hotel, review: r) { note in toast(note) }
            }
            // No fixed size: the text takes what's left of the card and ends in "…" instead of
            // running past the bottom edge (Arabic lines are taller). Long-press reads it all.
            Text(r.t)
                .font(.app(.subheadline))
                .lineLimit(6)
            Spacer(minLength: 0)
        }
        .padding(16)
        .frame(width: 280, height: 170, alignment: .topLeading)
        .background(Color.surface, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .fullReviewOnLongPress(r.t) {
            HStack(spacing: 6) {
                starsRow(r.s ?? 0)
                if let d = Fmt.day(r.d) {
                    Text("· \(d)").font(.app(.caption)).foregroundStyle(.secondary)
                }
            }
        }
    }

    private var distribution: some View {
        let d = hotel.dist
        let rows: [(Int, Int)] = [(5, d?.fiveStar ?? 0), (4, d?.fourStar ?? 0), (3, d?.threeStar ?? 0), (2, d?.twoStar ?? 0), (1, d?.oneStar ?? 0)]
        let total = max(1, rows.reduce(0) { $0 + $1.1 })
        return VStack(spacing: 5) {
            ForEach(rows, id: \.0) { star, count in
                HStack(spacing: 8) {
                    Text("\(star)").frame(width: 10, alignment: .leading)
                    ProgressView(value: Double(count), total: Double(total)).tint(Color.good)
                }
                .font(.app(.caption))
                .monospacedDigit()
                .foregroundStyle(.secondary)
            }
        }
    }

    private func location(_ traits: StayTraits) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            if let c = hotel.coordinate {
                Menu {
                    if let url = hotel.appleMapsURL { Button("Open in Apple Maps", systemImage: "map") { openURL(url) } }
                    if let url = hotel.googleMapsURL { Button("Open in Google Maps", systemImage: "globe") { openURL(url) } }
                } label: {
                    Map(initialPosition: .region(MKCoordinateRegion(center: c, latitudinalMeters: 1400, longitudinalMeters: 1400))) {
                        Marker(hotel.name, systemImage: NoPhoto.symbol(for: hotel.type), coordinate: c)
                            .tint(Color.accentColor)
                    }
                    .mapStyle(.standard(pointsOfInterest: .excludingAll))
                    .allowsHitTesting(false)
                    .frame(height: 200)
                    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                    .overlay(alignment: .topTrailing) {
                        Image(systemName: "arrow.up.left.and.arrow.down.right")
                            .font(.app(.footnote, .semibold))
                            .padding(9)
                            .background(.regularMaterial, in: Circle())
                            .padding(10)
                    }
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Open the map")
            }
            if !hotel.address.isEmpty {
                Text(hotel.address)
                    .font(.app(.subheadline))
                    .textSelection(.enabled)
            }
            if let km = traits.km, let label = traits.centreLabel {
                Text("\(Fmt.distance(km)) from \(label)")
                    .font(.app(.subheadline))
                    .foregroundStyle(.secondary)
            }
        }
    }

    /// Settings-style rows, IHG/Marriott pattern. Long-press any row to copy.
    private var contact: some View {
        VStack(spacing: 0) {
            if let tel = hotel.telURL {
                contactRow("phone.fill", "Phone", hotel.phone) { openURL(tel) }
                    .contextMenu { Button("Copy number", systemImage: "doc.on.doc") { copy(hotel.phone, note: "Number copied") } }
            }
            if !hotel.email.isEmpty, let mail = URL(string: "mailto:\(hotel.email)") {
                if hotel.telURL != nil { Divider().overlay(Color.line).padding(.leading, 44) }
                contactRow("envelope.fill", "Email", hotel.email) { openURL(mail) }
                    .contextMenu { Button("Copy email", systemImage: "doc.on.doc") { copy(hotel.email, note: "Email copied") } }
            }
            if let web = hotel.websiteURL {
                if hotel.telURL != nil || !hotel.email.isEmpty { Divider().overlay(Color.line).padding(.leading, 44) }
                contactRow("safari.fill", "Website", hotel.websiteLabel) { openURL(web) }
            }
        }
    }

    private func contactRow(_ icon: String, _ title: String, _ value: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 14) {
                Image(systemName: icon)
                    .foregroundStyle(Color.accentColor)
                    .frame(width: 30)
                VStack(alignment: .leading, spacing: 2) {
                    Text(L(title)).font(.app(.caption)).foregroundStyle(.secondary)
                    Text(value).font(.app(.body)).monospacedDigit().lineLimit(1)
                }
                Spacer()
                Image(systemName: "chevron.forward")
                    .font(.app(.footnote, .semibold))
                    .foregroundStyle(.tertiary)
            }
            .padding(.vertical, 12)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    @ViewBuilder
    private var nearby: some View {
        let near = store.nearby(hotel, limit: 8)
        if !near.isEmpty {
            VStack(alignment: .leading, spacing: 14) {
                Divider().overlay(Color.line).padding(.bottom, 6)
                SectionTitle("Nearby stays")
                ScrollView(.horizontal, showsIndicators: false) {
                    LazyHStack(alignment: .top, spacing: 12) {
                        ForEach(near, id: \.hotel.id) { CompactStayCard(hotel: $0.hotel) }
                    }
                    .scrollTargetLayout()
                }
                .scrollTargetBehavior(.viewAligned)
                .padding(.horizontal, -20)
                .contentMargins(.horizontal, 20, for: .scrollContent)
            }
        }
    }

    // MARK: Bottom bar

    private var bottomBar: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 2) {
                if let dzd = hotel.lowestDZD {
                    HStack(alignment: .firstTextBaseline, spacing: 3) {
                        Text(Money.dzd(dzd)).font(.app(.headline)).monospacedDigit().fixedSize()
                        Text("/ night").font(.app(.subheadline)).foregroundStyle(.secondary).fixedSize()
                    }
                    Text("Lowest online rate").font(.app(.caption)).foregroundStyle(.secondary)
                        .lineLimit(1).minimumScaleFactor(0.8)
                } else {
                    Text("Price on request").font(.app(.headline))
                    Text(hotel.telURL != nil ? L("Call for today’s rate") : L("Ask at the front desk"))
                        .font(.app(.caption)).foregroundStyle(.secondary)
                }
            }
            Spacer()
            if let tel = hotel.telURL {
                Link(destination: tel) {
                    Label("Call to book", systemImage: "phone.fill").fontWeight(.semibold)
                        .lineLimit(1).minimumScaleFactor(0.75)
                }
                .buttonStyle(.borderedProminent)
                .foregroundStyle(Color.onAccent)
                .controlSize(.large)
            } else if let url = hotel.appleMapsURL ?? hotel.googleMapsURL {
                Button { openURL(url) } label: {
                    Label("Directions", systemImage: "arrow.triangle.turn.up.right.diamond.fill").fontWeight(.semibold).lineLimit(1).fixedSize()
                }
                .buttonStyle(.borderedProminent)
                .foregroundStyle(Color.onAccent)
                .controlSize(.large)
            }
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 12)
        .background(Color.canvas.shadow(.drop(color: .black.opacity(0.12), radius: 8, y: -2)))
    }

    private func copy(_ text: String, note: String) {
        UIPasteboard.general.string = text
        toast(note)
    }

    private func toast(_ note: String) {
        withAnimation(.snappy) { copiedNote = note }
        Task {
            try? await Task.sleep(for: .seconds(1.6))
            withAnimation(.snappy) { copiedNote = nil }
        }
    }
}

/// Long descriptions show five lines with "Show more", Airbnb style.
private struct ExpandableText: View {
    let text: String
    @State private var expanded = false

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(text)
                .lineLimit(expanded ? nil : 5)
                .fixedSize(horizontal: false, vertical: true)
            if text.count > 240 {
                Button(expanded ? L("Show less") : L("Show more")) {
                    withAnimation(.snappy) { expanded.toggle() }
                }
                .font(.app(.subheadline, .semibold))
                .underline()
                .foregroundStyle(.primary)
            }
        }
    }
}
