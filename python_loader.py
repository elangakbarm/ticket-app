import asyncio
import aiohttp
import csv
import random
import statistics
import string
import time
from datetime import datetime


# ============================================================
# CONFIG
# ============================================================

API_URL = "http://localhost:3001/api/v1/stations"

# ============================================================
# PASTE JWT KAMU DI SINI
# ============================================================

JWT_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI5YzYyMjYzYS00NjM3LTQ0MjgtOWFmZi0wNTA5MDE0MDkzMWQiLCJlbWFpbCI6ImFkbWluQGV4YW1wbGUuY29tIiwicm9sZSI6IkFETUlOIiwiaWF0IjoxNzg2NDM4OTk1LCJleHAiOjE3ODY0Mzk4OTV9.RYzfzGaRugob_CKh-Vmz7ncUVDRU9riMaJxYn9bjyNI"


TOTAL_STATIONS = 1000
CONCURRENCY = 10

TIMEOUT_SECONDS = 30

RESULT_FILE = "results.csv"


# ============================================================
# DATA INDONESIA
# ============================================================

CITIES = [
    ("Jakarta", "DKI Jakarta", "Asia/Jakarta"),
    ("Bandung", "Jawa Barat", "Asia/Jakarta"),
    ("Bekasi", "Jawa Barat", "Asia/Jakarta"),
    ("Bogor", "Jawa Barat", "Asia/Jakarta"),
    ("Depok", "Jawa Barat", "Asia/Jakarta"),
    ("Cirebon", "Jawa Barat", "Asia/Jakarta"),
    ("Sukabumi", "Jawa Barat", "Asia/Jakarta"),
    ("Tasikmalaya", "Jawa Barat", "Asia/Jakarta"),

    ("Semarang", "Jawa Tengah", "Asia/Jakarta"),
    ("Surakarta", "Jawa Tengah", "Asia/Jakarta"),
    ("Yogyakarta", "DI Yogyakarta", "Asia/Jakarta"),
    ("Magelang", "Jawa Tengah", "Asia/Jakarta"),
    ("Tegal", "Jawa Tengah", "Asia/Jakarta"),
    ("Pekalongan", "Jawa Tengah", "Asia/Jakarta"),

    ("Surabaya", "Jawa Timur", "Asia/Jakarta"),
    ("Malang", "Jawa Timur", "Asia/Jakarta"),
    ("Kediri", "Jawa Timur", "Asia/Jakarta"),
    ("Madiun", "Jawa Timur", "Asia/Jakarta"),
    ("Jember", "Jawa Timur", "Asia/Jakarta"),
    ("Banyuwangi", "Jawa Timur", "Asia/Jakarta"),

    ("Denpasar", "Bali", "Asia/Makassar"),
    ("Mataram", "Nusa Tenggara Barat", "Asia/Makassar"),
    ("Kupang", "Nusa Tenggara Timur", "Asia/Makassar"),

    ("Banjarmasin", "Kalimantan Selatan", "Asia/Makassar"),
    ("Banjarbaru", "Kalimantan Selatan", "Asia/Makassar"),
    ("Balikpapan", "Kalimantan Timur", "Asia/Makassar"),
    ("Samarinda", "Kalimantan Timur", "Asia/Makassar"),
    ("Pontianak", "Kalimantan Barat", "Asia/Jakarta"),
    ("Palangka Raya", "Kalimantan Tengah", "Asia/Jakarta"),
    ("Tarakan", "Kalimantan Utara", "Asia/Makassar"),

    ("Makassar", "Sulawesi Selatan", "Asia/Makassar"),
    ("Manado", "Sulawesi Utara", "Asia/Makassar"),
    ("Palu", "Sulawesi Tengah", "Asia/Makassar"),
    ("Kendari", "Sulawesi Tenggara", "Asia/Makassar"),
    ("Gorontalo", "Gorontalo", "Asia/Makassar"),

    ("Ambon", "Maluku", "Asia/Jayapura"),
    ("Ternate", "Maluku Utara", "Asia/Jayapura"),
    ("Jayapura", "Papua", "Asia/Jayapura"),
    ("Sorong", "Papua Barat Daya", "Asia/Jayapura"),
]


STATION_NAMES = [
    "Gambir",
    "Jatinegara",
    "Pasar Senen",
    "Manggarai",
    "Bandung",
    "Kiaracondong",
    "Cimahi",
    "Bekasi",
    "Bogor",
    "Cirebon",
    "Semarang Tawang",
    "Semarang Poncol",
    "Solo Balapan",
    "Yogyakarta",
    "Lempuyangan",
    "Madiun",
    "Surabaya Gubeng",
    "Surabaya Pasar Turi",
    "Malang",
    "Jember",
    "Banyuwangi",
    "Ketapang",
    "Denpasar",
    "Mataram",
    "Makassar",
    "Manado",
    "Balikpapan",
    "Samarinda",
    "Banjarmasin",
    "Pontianak",
    "Jayapura",
]


# ============================================================
# GENERATE UNIQUE 3-CHARACTER CODE
# ============================================================

CITY_CODES = {
    "Jakarta": "JKT",
    "Bandung": "BDG",
    "Bekasi": "BKS",
    "Bogor": "BGR",
    "Depok": "DPK",
    "Cirebon": "CN",
    "Sukabumi": "SKB",
    "Tasikmalaya": "TSM",

    "Semarang": "SMG",
    "Surakarta": "SKA",
    "Yogyakarta": "YK",
    "Magelang": "MGL",
    "Tegal": "TGL",
    "Pekalongan": "PKL",

    "Surabaya": "SBY",
    "Malang": "MLG",
    "Kediri": "KDR",
    "Madiun": "MDN",
    "Jember": "JMR",
    "Banyuwangi": "BWX",

    "Denpasar": "DPS",
    "Mataram": "MTR",
    "Kupang": "KOE",

    "Banjarmasin": "BJM",
    "Banjarbaru": "BJB",
    "Balikpapan": "BPN",
    "Samarinda": "SMD",
    "Pontianak": "PNK",
    "Palangka Raya": "PKY",
    "Tarakan": "TRK",

    "Makassar": "MKS",
    "Manado": "MDC",
    "Palu": "PLW",
    "Kendari": "KDI",
    "Gorontalo": "GTO",

    "Ambon": "AMQ",
    "Ternate": "TTE",
    "Jayapura": "DJJ",
    "Sorong": "SOQ",
}


USED_CODES = set()


def generate_unique_code(city):

    base = CITY_CODES.get(
        city,
        "STN"
    )

    # Gunakan code asli terlebih dahulu
    if base not in USED_CODES:

        USED_CODES.add(base)

        return base

    # Kalau sudah digunakan,
    # cari kombinasi 3 huruf berikutnya
    for first in string.ascii_uppercase:

        for second in string.ascii_uppercase:

            candidate = (
                base[0] +
                first +
                second
            )

            if candidate not in USED_CODES:

                USED_CODES.add(candidate)

                return candidate

    raise RuntimeError(
        "Tidak bisa membuat code unik."
    )


# ============================================================
# GENERATE STATION
# ============================================================

def generate_station(index):

    city, province, timezone = random.choice(
        CITIES
    )

    station_name = random.choice(
        STATION_NAMES
    )

    code = generate_unique_code(
        city
    )

    address_number = random.randint(
        1,
        999
    )

    address_street = random.choice([
        "Jl. Stasiun",
        "Jl. Raya",
        "Jl. Nasional",
        "Jl. Ahmad Yani",
        "Jl. Sudirman",
        "Jl. Gatot Subroto",
        "Jl. Diponegoro",
        "Jl. Pemuda",
    ])

    address = (
        f"{address_street} No. "
        f"{address_number}, "
        f"{city}"
    )

    return {
        "code": code,
        "name": f"{station_name} {index}",
        "city": city,
        "province": province,
        "address": address,
        "timezone": timezone,
    }


# ============================================================
# GENERATE ALL STATIONS
# ============================================================

def generate_stations():

    print("=" * 70)
    print("GENERATING STATIONS")
    print("=" * 70)

    stations = []

    for i in range(
        1,
        TOTAL_STATIONS + 1
    ):

        stations.append(
            generate_station(i)
        )

    print(
        f"Generated {len(stations)} stations"
    )

    print()
    print("Sample:")

    for station in stations[:5]:

        print(station)

    return stations


# ============================================================
# POST STATION
# ============================================================

async def post_station(
    session,
    station,
    semaphore,
    results
):

    async with semaphore:

        start = time.perf_counter()

        timestamp = (
            datetime.now().isoformat()
        )

        try:

            async with session.post(
                API_URL,

                json=station,

                headers={
                    "Authorization":
                        f"Bearer {JWT_TOKEN}",
                    "Content-Type":
                        "application/json"
                },

                timeout=aiohttp.ClientTimeout(
                    total=TIMEOUT_SECONDS
                )

            ) as response:

                body = await response.text()

                elapsed = (
                    time.perf_counter()
                    - start
                )

                success = (
                    200 <= response.status < 300
                )

                results.append({

                    "timestamp":
                        timestamp,

                    "code":
                        station["code"],

                    "name":
                        station["name"],

                    "status":
                        response.status,

                    "latency_ms":
                        round(
                            elapsed * 1000,
                            2
                        ),

                    "success":
                        success,

                    "error":
                        "" if success
                        else body[:500]

                })

                print(
                    f'{station["code"]:<8} '
                    f'{response.status:<4} '
                    f'{elapsed * 1000:>9.2f} ms'
                )

        except Exception as e:

            elapsed = (
                time.perf_counter()
                - start
            )

            results.append({

                "timestamp":
                    timestamp,

                "code":
                    station["code"],

                "name":
                    station["name"],

                "status":
                    0,

                "latency_ms":
                    round(
                        elapsed * 1000,
                        2
                    ),

                "success":
                    False,

                "error":
                    str(e)

            })

            print(
                f'{station["code"]:<8} '
                f'ERROR '
                f'{elapsed * 1000:>9.2f} ms'
            )


# ============================================================
# PERCENTILE
# ============================================================

def percentile(values, p):

    if not values:

        return 0

    values = sorted(values)

    index = int(
        len(values) * p
    )

    index = min(
        index,
        len(values) - 1
    )

    return values[index]


# ============================================================
# SAVE RESULTS
# ============================================================

def save_results(results):

    with open(
        RESULT_FILE,
        "w",
        newline="",
        encoding="utf-8"
    ) as file:

        writer = csv.DictWriter(
            file,
            fieldnames=[
                "timestamp",
                "code",
                "name",
                "status",
                "latency_ms",
                "success",
                "error"
            ]
        )

        writer.writeheader()

        writer.writerows(
            results
        )


# ============================================================
# LOAD TEST
# ============================================================

async def run_test(stations):

    print()
    print("=" * 70)
    print("START LOAD TEST")
    print("=" * 70)

    print(
        f"API         : {API_URL}"
    )

    print(
        f"Requests    : {len(stations)}"
    )

    print(
        f"Concurrency : {CONCURRENCY}"
    )

    print()

    results = []

    semaphore = asyncio.Semaphore(
        CONCURRENCY
    )

    connector = aiohttp.TCPConnector(
        limit=CONCURRENCY
    )

    start_time = time.perf_counter()

    async with aiohttp.ClientSession(
        connector=connector
    ) as session:

        tasks = [

            post_station(
                session,
                station,
                semaphore,
                results
            )

            for station in stations
        ]

        await asyncio.gather(
            *tasks
        )

    total_time = (
        time.perf_counter()
        - start_time
    )

    # ========================================================
    # STATISTICS
    # ========================================================

    total = len(results)

    success = sum(
        1
        for result in results
        if result["success"]
    )

    failed = (
        total - success
    )

    latencies = [
        result["latency_ms"]
        for result in results
        if result["success"]
    ]

    throughput = (
        total / total_time
        if total_time > 0
        else 0
    )

    print()
    print("=" * 70)
    print("PERFORMANCE RESULT")
    print("=" * 70)

    print(
        f"Total request : {total}"
    )

    print(
        f"Success       : {success}"
    )

    print(
        f"Failed        : {failed}"
    )

    print(
        f"Total time    : {total_time:.2f} sec"
    )

    print(
        f"Throughput    : {throughput:.2f} req/sec"
    )

    if latencies:

        print()
        print("LATENCY")
        print("-" * 70)

        print(
            f"Min           : "
            f"{min(latencies):.2f} ms"
        )

        print(
            f"Max           : "
            f"{max(latencies):.2f} ms"
        )

        print(
            f"Average       : "
            f"{statistics.mean(latencies):.2f} ms"
        )

        print(
            f"P50           : "
            f"{percentile(latencies, 0.50):.2f} ms"
        )

        print(
            f"P95           : "
            f"{percentile(latencies, 0.95):.2f} ms"
        )

        print(
            f"P99           : "
            f"{percentile(latencies, 0.99):.2f} ms"
        )

    # ========================================================
    # STATUS CODE SUMMARY
    # ========================================================

    status_codes = {}

    for result in results:

        status = result["status"]

        status_codes[status] = (
            status_codes.get(
                status,
                0
            ) + 1
        )

    print()
    print("STATUS CODE")
    print("-" * 70)

    for status, count in sorted(
        status_codes.items()
    ):

        print(
            f"{status}: {count}"
        )

    save_results(
        results
    )

    print()
    print(
        f"Results saved to "
        f"{RESULT_FILE}"
    )


# ============================================================
# MAIN
# ============================================================

async def main():

    # Jangan lupa paste JWT
    if (
        not JWT_TOKEN
        or JWT_TOKEN
        == "PASTE_JWT_KAMU_DI_SINI"
    ):

        print(
            "ERROR: JWT_TOKEN belum diisi."
        )

        return

    stations = generate_stations()

    print()
    print("=" * 70)

    answer = input(
        f"POST {len(stations)} stations? [y/N]: "
    )

    if answer.lower() != "y":

        print("Cancelled.")

        return

    await run_test(
        stations
    )


if __name__ == "__main__":

    try:

        asyncio.run(
            main()
        )

    except KeyboardInterrupt:

        print()
        print(
            "Interrupted."
        )
