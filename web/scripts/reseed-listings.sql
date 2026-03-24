DELETE FROM rwa_investments;
DELETE FROM rwa_tokens;
DELETE FROM listings;

INSERT INTO listings (id, host_id, operator_id, title, description, price_per_night, max_guests, location, region, amenities, images, lat, lng, renovation_history, transport_support, smart_lock_enabled, valuation_krw) VALUES
(
  'gyeongju-3000',
  'seed-spv-3000-hwango',
  'seed-op-3000-hwango',
  '황오동 청송재',
  '황리단길 도보 8분, 경주 구도심 골목 안쪽에 자리한 레트로 감성 게스트하우스. 1970년대 단층 한옥을 되살려 낮에는 마당 평상에서 황남빵 티타임을, 밤에는 마당에서 별빛 아래 조용한 시간을 보낼 수 있습니다. 혼자 또는 둘이 오기 딱 좋은 아늑한 두 평 마당이 있어요.',
  70000, 2, '경상북도 경주시 황오동 일대', '경상',
  '["Wi-Fi","에어컨","온돌 난방","개별 화장실","간이 주방","주차 1대"]',
  '["/hwango.png"]',
  35.8320, 129.2150,
  '[{"date":"2023.09","desc":"기초 구조 진단 — 담장·기단 원형 보존 결정"},{"date":"2024.03","desc":"기와지붕 복원 및 목구조 보강 완료"},{"date":"2024.09","desc":"황토 미장 인테리어·마당 평상 조성, Rural Rest 등록"}]',
  0, 0, 50000000
);

INSERT INTO listings (id, host_id, operator_id, title, description, price_per_night, max_guests, location, region, amenities, images, lat, lng, renovation_history, transport_support, smart_lock_enabled, valuation_krw) VALUES
(
  'gyeongju-3001',
  'seed-spv-3001-seonggon',
  'seed-op-3001-seonggon',
  '성건동 충재댁',
  '성건동 오래된 단독주택을 리모델링한 전통 감성 숙소. 첨성대 도보 5분, 대릉원 도보 8분. 수국과 소나무가 어우러진 정원이 인상적이며, 전통 다도 체험 및 한복 무료 대여 포함, 아침 죽 조식 제공.',
  90000, 2, '경상북도 경주시 성건동 일대', '경상',
  '["Wi-Fi","에어컨","온돌 난방","공용 화장실","주차 1대","한복 대여","조식 포함"]',
  '["/seonggon.png"]',
  35.8345, 129.2245,
  '[{"date":"2024.01","desc":"외벽 방수 처리 및 전통 문양 복원"},{"date":"2024.06","desc":"온돌 시스템 교체 및 내부 인테리어 완성"},{"date":"2024.10","desc":"다도실·한복 보관실 조성 완료, Rural Rest 등록"}]',
  0, 0, 80000000
);

INSERT INTO listings (id, host_id, operator_id, title, description, price_per_night, max_guests, location, region, amenities, images, lat, lng, renovation_history, transport_support, smart_lock_enabled, valuation_krw) VALUES
(
  'gyeongju-3002',
  'seed-spv-3002-dongcheon',
  'seed-op-3002-dongcheon',
  '동천동 신라숲',
  '경주 시내와 보문관광단지 사이, 신라 고분군을 걸어서 닿을 수 있는 아늑한 단독 숙소. 전통 기와지붕과 소나무 마당이 어우러진 공간으로, 자전거 무료 대여와 공용 주방이 갖춰져 있습니다. 경주 핵심 여행지를 자전거로 탐방하기 최적의 베이스캠프입니다.',
  25000, 4, '경상북도 경주시 동천동 일대', '경상',
  '["Wi-Fi","에어컨","공용 샤워실","공용 주방","세탁기","자전거 무료 대여","주차 3대"]',
  '["/dongcheon.png"]',
  35.8550, 129.2100,
  '[{"date":"2025.02","desc":"기초 구조 진단 및 안전 보강 설계 완료"},{"date":"2025.06","desc":"내부 리모델링 및 공용 주방 증축"},{"date":"2025.10","desc":"자전거 보관소·마당 정원 조성, Rural Rest 등록"}]',
  0, 0, 45000000
);

INSERT INTO listings (id, host_id, operator_id, title, description, price_per_night, max_guests, location, region, amenities, images, lat, lng, renovation_history, transport_support, smart_lock_enabled, valuation_krw) VALUES
(
  'gyeongju-3003',
  'seed-spv-3003-geoncheon',
  'seed-op-3003-geoncheon',
  '건천읍 월성',
  '경주 외곽 건천 들녘 한가운데 자리한 워케이션 특화 독채. 대형 통창 너머로 펼쳐지는 들녘 풍경 속에서 집중 작업과 완전한 휴식을 동시에 누릴 수 있습니다. 옥상 테라스에서 탁 트인 경주 교외 전망을 즐기세요.',
  55000, 2, '경상북도 경주시 건천읍 일대', '경상',
  '["Wi-Fi","에어컨","온돌 난방","개별 화장실","주방","작업 책상","옥상 테라스","자전거 무료 대여","주차 2대"]',
  '["/geoncheon.png"]',
  35.9250, 129.1980,
  '[{"date":"2024.03","desc":"농가주택 구조 보강 및 외벽 단열 공사 완료"},{"date":"2024.08","desc":"워케이션 특화 내부 설계 — 작업 책상·고속 인터넷 설치"},{"date":"2024.12","desc":"옥상 테라스 조성 및 워케이션 공간 완성, Rural Rest 등록"}]',
  0, 0, 35000000
);

INSERT INTO listings (id, host_id, operator_id, title, description, price_per_night, max_guests, location, region, amenities, images, lat, lng, renovation_history, transport_support, smart_lock_enabled, valuation_krw) VALUES
(
  'gyeongju-3004',
  'seed-spv-3004-angang',
  'seed-op-3004-angang',
  '안강읍 석굴재',
  '불국사 차량 20분, 안강 너른 들판이 마당 끝까지 펼쳐지는 농가 독채. 봄엔 딸기·봄나물, 가을엔 사과·고구마 직접 수확하고, 저녁엔 마당 바베큐·불멍. 아침은 직접 지은 경주 쌀밥 시골 밥상으로 시작됩니다.',
  65000, 4, '경상북도 경주시 안강읍 일대', '경상',
  '["Wi-Fi","에어컨","온돌 난방","개별 화장실","주방","바베큐 그릴","텃밭 체험","조식 포함","주차 3대"]',
  '["/angang.png"]',
  35.9500, 129.1850,
  '[{"date":"2023.11","desc":"농가주택 매입 및 기초 구조 진단 완료"},{"date":"2024.05","desc":"주택 구조 보강 및 전통 마당 석축 복원"},{"date":"2024.11","desc":"바베큐 시설·농작물 수확 체험장 조성, Rural Rest 등록"}]',
  0, 0, 40000000
);

SELECT id, title, valuation_krw FROM listings ORDER BY id;
