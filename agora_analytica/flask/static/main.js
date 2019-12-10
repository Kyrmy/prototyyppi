function show_node_info(id){
console.log("ddd", id)
d3.json("/api/node/"+id+".json", function(err, data){
console.log("kkkkkkk", data)

/*console.log(data.name)
console.log(data.vaalipiiri)
console.log(data.party)*/

color = node_color(data)
document.getElementById("modalheader").style.backgroundColor = color;

console.log(color)

$("#candidateName").text("Name: " + data.name)
$("#candidateNumber").text("Candidate number: " + data.candidatenumber)
$("#candidateParty").text("Party: " + data.party)
$("#candidateConstituency").text("Constituency: " + data.constituency)

$("#candidateInformationModal").modal('show')
$('.modal-backdrop').removeClass("modal-backdrop");
$(".modal-dialog").draggable({
    "handle":".modal-header",
    "containment":"window"
});
})
}

function ui_init_filters(nodes) {
    // Kerää puolueet ja vaalipiirit solmuista
    const parties = ["--"]
    const constituencies = ["--"]

    // Generoi listat
    parties.forEach(function(party) {
        // Generoi HTML elementit, ja sido niihin tapahtumat
        let list_item = $("<li><lable>").text(party);
        checkbox.on("click", function() {
            // Tapahtuma joka tapahtuu kun filtteriä klikataan.
            // Tässä tulisi kerätäaktiiviset suotimet

            // Filterrisääntöjen kirjoitus on dict/object, jossa avain vastaa nodesin avainta, ja arvo
            // on lista filtteröitävistä arvoista.

            // HUOMAA: Säännöt toimivat käänteisesti valinnan kanssa, eli ne filteröidään joita EI ole valittu.
            const filter_rules = {
                parties: [party, "muu", "party", "jota", "EI", "ole", "valittu"],
                constituency: ["..."]
            }

            // Kutsu filtteröintiä.
            graph_filter(filter_rules)
        });
        $("#filter-parties").append(list_item);
    });
    // constituencies.forEach(...)
}

