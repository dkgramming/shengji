/* tslint:disable:max-classes-per-file variable-name forin */
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import Errors from './Errors';
import Trump from './Trump';
import FriendSelect from './FriendSelect';
import LabeledPlay from './LabeledPlay';
import Initialize from './Initialize';
import JoinRoom from './JoinRoom';
import Card from './Card';
import Header from './Header';
import Friends from './Friends';
import Players from './Players';
import AppStateProvider, {AppStateContext} from './AppStateProvider';
import WebsocketProvider from './WebsocketProvider';
import TimerProvider, {TimerContext} from './TimerProvider';
import Credits from './Credits';
import Chat from './Chat';
import Cards from './Cards';
import Play from './Play';
import {IDrawPhase, IExchangePhase, IFriend, IPlayer} from './types';
import * as ReactModal from 'react-modal';
ReactModal.setAppElement(document.getElementById('root'));

type IDrawProps = {
  state: IDrawPhase;
  name: string;
  cards: string[];
  setTimeout: (fn: () => void, timeout: number) => number;
  clearTimeout: (id: number) => void;
};
interface IDrawState {
  selected: string[];
  autodraw: boolean;
}
class Draw extends React.Component<IDrawProps, IDrawState> {
  private could_draw: boolean = false;
  private timeout: number | null = null;

  constructor(props: IDrawProps) {
    super(props);
    this.state = {
      selected: [],
      autodraw: true,
    };
    this.setSelected = this.setSelected.bind(this);
    this.makeBid = this.makeBid.bind(this);
    this.drawCard = this.drawCard.bind(this);
    this.onAutodrawClicked = this.onAutodrawClicked.bind(this);
  }

  setSelected(new_selected: string[]) {
    this.setState({selected: new_selected});
  }

  makeBid(evt: any) {
    evt.preventDefault();
    const counts: {[card: string]: number} = {};
    this.state.selected.forEach((c) => (counts[c] = (counts[c] || 0) + 1));
    if (Object.keys(counts).length !== 1) {
      return;
    }

    const players: {[player_id: number]: IPlayer} = {};
    this.props.state.propagated.players.forEach((p) => {
      players[p.id] = p;
    });

    for (const c in counts) {
      let already_bid = 0;
      this.props.state.bids.forEach((bid) => {
        if (players[bid.id].name === this.props.name && bid.card === c) {
          already_bid = already_bid < bid.count ? bid.count : already_bid;
        }
      });

      send({Action: {Bid: [c, counts[c] + already_bid]}});
      this.setSelected([]);
    }
  }

  drawCard() {
    const can_draw =
      this.props.state.propagated.players[this.props.state.position].name ===
      this.props.name;
    if (this.timeout) {
      this.props.clearTimeout(this.timeout);
      this.timeout = null;
    }
    if (can_draw) {
      send({Action: 'DrawCard'});
    }
  }

  pickUpKitty(evt: any) {
    evt.preventDefault();
    send({Action: 'PickUpKitty'});
  }

  onAutodrawClicked(evt: any) {
    this.setState({
      autodraw: evt.target.checked,
    });
    if (evt.target.checked) {
      this.drawCard();
    } else {
      if (this.timeout) {
        clearTimeout(this.timeout);
        this.timeout = null;
      }
    }
  }

  render() {
    const can_draw =
      this.props.state.propagated.players[this.props.state.position].name ===
        this.props.name && this.props.state.deck.length > 0;
    if (
      can_draw &&
      !this.could_draw &&
      this.timeout === null &&
      this.state.autodraw
    ) {
      this.timeout = this.props.setTimeout(() => {
        this.drawCard();
      }, 250);
    }
    this.could_draw = can_draw;

    let next = this.props.state.propagated.players[this.props.state.position]
      .id;
    if (
      this.props.state.deck.length === 0 &&
      this.props.state.bids.length > 0
    ) {
      next = this.props.state.bids[this.props.state.bids.length - 1].id;
    }

    const players: {[player_id: number]: IPlayer} = {};
    let player_id = -1;
    this.props.state.propagated.players.forEach((p) => {
      players[p.id] = p;
      if (p.name === this.props.name) {
        player_id = p.id;
      }
    });

    const my_bids: {[card: string]: number} = {};
    this.props.state.bids.forEach((bid) => {
      if (player_id === bid.id) {
        const existing_bid = my_bids[bid.card] || 0;
        my_bids[bid.card] = existing_bid < bid.count ? bid.count : existing_bid;
      }
    });
    const cards_not_bid = [...this.props.cards];

    Object.keys(my_bids).forEach((card) => {
      const count = my_bids[card] || 0;
      for (let i = 0; i < count; i = i + 1) {
        const card_idx = cards_not_bid.indexOf(card);
        if (card_idx >= 0) {
          cards_not_bid.splice(card_idx, 1);
        }
      }
    });

    return (
      <div>
        <Header
          gameMode={this.props.state.game_mode}
          chatLink={this.props.state.propagated.chat_link}
        />
        <Players
          players={this.props.state.propagated.players}
          landlord={this.props.state.propagated.landlord}
          next={next}
          name={this.props.name}
        />
        <div>
          <h2>
            Bids ({this.props.state.deck.length} cards remaining in the deck)
          </h2>
          {this.props.state.bids.map((bid, idx) => {
            const name = players[bid.id].name;
            return (
              <LabeledPlay
                label={name}
                key={idx}
                cards={Array(bid.count).fill(bid.card)}
              />
            );
          })}
        </div>
        <button
          onClick={(evt: any) => {
            evt.preventDefault();
            this.drawCard();
          }}
          disabled={!can_draw}
        >
          Draw card
        </button>
        <label>
          auto-draw
          <input
            type="checkbox"
            name="autodraw"
            checked={this.state.autodraw}
            onChange={this.onAutodrawClicked}
          />
        </label>
        <button
          onClick={this.makeBid}
          disabled={this.state.selected.length === 0}
        >
          Make bid
        </button>
        <button
          onClick={this.pickUpKitty}
          disabled={
            this.props.state.deck.length > 0 ||
            this.props.state.bids.length === 0 ||
            (this.props.state.propagated.landlord !== null &&
              this.props.state.propagated.landlord !== player_id) ||
            (this.props.state.propagated.landlord === null &&
              this.props.state.bids[this.props.state.bids.length - 1].id !==
                player_id)
          }
        >
          Pick up cards from the bottom
        </button>
        <Cards
          cardsInHand={cards_not_bid}
          selectedCards={this.state.selected}
          onSelect={this.setSelected}
        />
      </div>
    );
  }
}

type IExchangeProps = {
  state: IExchangePhase;
  name: string;
  cards: string[];
};
interface IExchangeState {
  friends: IFriend[];
}
class Exchange extends React.Component<IExchangeProps, IExchangeState> {
  constructor(props: IExchangeProps) {
    super(props);
    this.moveCardToKitty = this.moveCardToKitty.bind(this);
    this.moveCardToHand = this.moveCardToHand.bind(this);
    this.startGame = this.startGame.bind(this);
    this.pickFriends = this.pickFriends.bind(this);
    this.state = {
      friends: [],
    };

    this.fixFriends = this.fixFriends.bind(this);
  }

  fixFriends() {
    if (this.props.state.game_mode !== 'Tractor') {
      const game_mode = this.props.state.game_mode.FindingFriends;
      const num_friends = game_mode.num_friends;
      const prop_friends = game_mode.friends;
      if (num_friends !== this.state.friends.length) {
        if (prop_friends.length !== num_friends) {
          const friends = [...this.state.friends];
          while (friends.length < num_friends) {
            friends.push({
              card: '',
              skip: 0,
              player_id: null,
            });
          }
          while (friends.length > num_friends) {
            friends.pop();
          }
          this.setState({friends});
        } else {
          this.setState({friends: prop_friends});
        }
      }
    } else {
      if (this.state.friends.length !== 0) {
        this.setState({friends: []});
      }
    }
  }

  componentDidMount() {
    this.fixFriends();
  }

  componentDidUpdate() {
    this.fixFriends();
  }

  moveCardToKitty(card: string) {
    send({Action: {MoveCardToKitty: card}});
  }

  moveCardToHand(card: string) {
    send({Action: {MoveCardToHand: card}});
  }

  startGame(evt: any) {
    evt.preventDefault();
    send({Action: 'BeginPlay'});
  }

  pickFriends(evt: any) {
    evt.preventDefault();
    if (
      this.props.state.game_mode !== 'Tractor' &&
      this.props.state.game_mode.FindingFriends.num_friends ===
        this.state.friends.length
    ) {
      send({
        Action: {
          SetFriends: this.state.friends,
        },
      });
    } else {
      this.fixFriends();
    }
  }

  render() {
    let landlord_idx = 0;
    this.props.state.propagated.players.forEach((player, idx) => {
      if (player.id === this.props.state.landlord) {
        landlord_idx = idx;
      }
    });
    if (
      this.props.state.propagated.players[landlord_idx].name === this.props.name
    ) {
      return (
        <div>
          <Header
            gameMode={this.props.state.game_mode}
            chatLink={this.props.state.propagated.chat_link}
          />
          <Players
            players={this.props.state.propagated.players}
            landlord={this.props.state.landlord}
            next={this.props.state.landlord}
            name={this.props.name}
          />
          <Trump trump={this.props.state.trump} />
          {this.props.state.game_mode !== 'Tractor' ? (
            <div>
              <Friends gameMode={this.props.state.game_mode} />
              {this.state.friends.map((friend, idx) => {
                const onChange = (x: IFriend) => {
                  const new_friends = [...this.state.friends];
                  new_friends[idx] = x;
                  this.setState({friends: new_friends});
                  this.fixFriends();
                };
                return (
                  <FriendSelect
                    onChange={onChange}
                    key={idx}
                    friend={friend}
                    trump={this.props.state.trump}
                    num_decks={this.props.state.num_decks}
                  />
                );
              })}
              <button onClick={this.pickFriends}>Pick friends</button>
            </div>
          ) : null}
          <h2>Your hand</h2>
          <div className="hand">
            {this.props.cards.map((c, idx) => (
              <Card
                key={idx}
                onClick={() => this.moveCardToKitty(c)}
                card={c}
              />
            ))}
          </div>
          <h2>
            Discarded cards {this.props.state.kitty.length} /{' '}
            {this.props.state.kitty_size}
          </h2>
          <div className="kitty">
            {this.props.state.kitty.map((c, idx) => (
              <Card key={idx} onClick={() => this.moveCardToHand(c)} card={c} />
            ))}
          </div>
          <button
            onClick={this.startGame}
            disabled={
              this.props.state.kitty.length !== this.props.state.kitty_size
            }
          >
            Start game
          </button>
        </div>
      );
    } else {
      return (
        <div>
          <Header
            gameMode={this.props.state.game_mode}
            chatLink={this.props.state.propagated.chat_link}
          />
          <Players
            players={this.props.state.propagated.players}
            landlord={this.props.state.landlord}
            next={this.props.state.landlord}
            name={this.props.name}
          />
          <Trump trump={this.props.state.trump} />
          <div className="hand">
            {this.props.cards.map((c, idx) => (
              <Card key={idx} card={c} />
            ))}
          </div>
          <p>Waiting...</p>
        </div>
      );
    }
  }
}

if (window.location.hash.length !== 17) {
  const arr = new Uint8Array(8);
  window.crypto.getRandomValues(arr);
  const r = Array.from(arr, (d) => ('0' + d.toString(16)).substr(-2)).join('');
  window.location.hash = r;
}

const Root = () => {
  const {state, updateState} = React.useContext(AppStateContext);
  const timerContext = React.useContext(TimerContext);
  if (state.connected) {
    if (state.game_state === null) {
      return (
        <div>
          <Errors errors={state.errors} />
          <div className="game">
            <h1>
              升级 / <span className="red">Tractor</span> / 找朋友 /{' '}
              <span className="red">Finding Friends</span>
            </h1>
            <JoinRoom
              name={state.name}
              room_name={state.roomName}
              setName={(name: string) => updateState({name})}
              setRoomName={(roomName: string) => {
                updateState({roomName});
                window.location.hash = roomName;
              }}
            />
          </div>
          <hr />
          <Credits />
        </div>
      );
    } else {
      const cards = [...state.cards];
      if (state.settings.reverseCardOrder) {
        cards.reverse();
      }
      return (
        <div className={state.settings.fourColor ? 'four-color' : ''}>
          <Errors errors={state.errors} />
          <div className="game">
            {state.game_state.Initialize ? null : (
              <a
                href={window.location.href}
                className="reset-link"
                onClick={(evt) => {
                  evt.preventDefault();
                  if (window.confirm('Do you really want to reset the game?')) {
                    send({Action: 'ResetGame'});
                  }
                }}
              >
                Reset game
              </a>
            )}
            {state.game_state.Initialize ? (
              <Initialize
                state={state.game_state.Initialize}
                cards={cards}
                name={state.name}
              />
            ) : null}
            {state.game_state.Draw ? (
              <Draw
                state={state.game_state.Draw}
                cards={cards}
                name={state.name}
                setTimeout={timerContext.setTimeout}
                clearTimeout={timerContext.clearTimeout}
              />
            ) : null}
            {state.game_state.Exchange ? (
              <Exchange
                state={state.game_state.Exchange}
                cards={cards}
                name={state.name}
              />
            ) : null}
            {state.game_state.Play ? (
              <Play
                playPhase={state.game_state.Play}
                cards={cards}
                name={state.name}
                showLastTrick={state.settings.showLastTrick}
                unsetAutoPlayWhenWinnerChanges={
                  state.settings.unsetAutoPlayWhenWinnerChanges
                }
                beepOnTurn={state.settings.beepOnTurn}
              />
            ) : null}
          </div>
          <Chat messages={state.messages} />
          <hr />
          <Credits />
        </div>
      );
    }
  } else {
    return <p>disconnected from server, please refresh</p>;
  }
};

const bootstrap = () => {
  ReactDOM.render(
    <AppStateProvider>
      <WebsocketProvider>
        <TimerProvider>
          <Root />
        </TimerProvider>
      </WebsocketProvider>
    </AppStateProvider>,
    document.getElementById('root'),
  );
};

bootstrap();

declare var send: (value: any) => void;
