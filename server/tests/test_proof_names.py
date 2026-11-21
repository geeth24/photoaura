from services.proof_service import next_proof_name


def test_first_refresh_adds_r2():
    assert next_proof_name("Party-171-preview.jpg", set()) == "Party-171-preview-r2.jpg"


def test_later_refreshes_count_up():
    assert next_proof_name("Party-171-preview-r2.jpg", set()) == "Party-171-preview-r3.jpg"
    assert next_proof_name("Party-171-preview-r9.jpg", set()) == "Party-171-preview-r10.jpg"


def test_skips_names_already_taken_case_insensitively():
    taken = {"party-171-preview-r2.jpg", "party-171-preview-r3.jpg"}
    assert next_proof_name("Party-171-preview.jpg", taken) == "Party-171-preview-r4.jpg"
