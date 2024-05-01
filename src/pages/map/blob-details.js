export const BlobDetails = ({onFollow, isFollowing, isFPV, onSetFPV, ...props}) => {

    const onFollowClick = e => {
        e.preventDefault();
        e.stopPropagation();
        onFollow();
    }

    return (<div className={'blob-window box'}>
        <p>Blob: {props.id}</p>
        <p>Age: {props.age}</p>
        <p>Hunger: {props.foodStat}</p>
        <p>Position: {props.displayX}:{props.displayY}</p>
        <p>Cell: {props.cellX}:{props.cellY}</p>
        <p>Activity: {props.action}</p>
        <p>AnimD: {props.animation}</p>
        <div className={'buttons flex'}>
            <button onClick={onFollowClick}>{isFollowing ? 'Stop Following' : 'Follow'}</button>
            <button onClick={onSetFPV}>{isFPV ? 'Stop 1st person' : 'Start 1st person'}</button>
        </div>
    </div> )
}